import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PLAN_LIMITS = { free: 3, pro: 50, team: 500 } as const;

const ExtractedSchema = z.object({
  document_type: z.enum(["invoice", "receipt", "purchase_order", "other"]).nullable().optional(),
  vendor_name: z.string().nullable().optional(),
  invoice_number: z.string().nullable().optional(),
  invoice_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
  subtotal: z.number().nullable().optional(),
  tax_amount: z.number().nullable().optional(),
  total_amount: z.number().nullable().optional(),
  overall_confidence: z.number().min(0).max(1).nullable().optional(),
  confidence: z.record(z.string(), z.enum(["high", "medium", "low"])).nullable().optional(),
  line_items: z.array(z.object({
    description: z.string().nullable().optional(),
    quantity: z.number().nullable().optional(),
    unit_price: z.number().nullable().optional(),
    line_total: z.number().nullable().optional(),
    confidence: z.enum(["high", "medium", "low"]).nullable().optional(),
  })).nullable().optional(),
});

export const extractDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { documentId: string }) =>
    z.object({ documentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch document & ownership
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("*")
      .eq("id", data.documentId)
      .maybeSingle();
    if (docErr || !doc) throw new Error("Document not found");

    try {
      // Reset monthly counter if period rolled over, enforce plan limits
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan, documents_used_this_month, usage_period_start, team_id")
        .eq("id", userId)
        .maybeSingle();

      if (profile) {
        const now = new Date();
        const period = new Date(profile.usage_period_start);
        const sameMonth = period.getUTCFullYear() === now.getUTCFullYear() && period.getUTCMonth() === now.getUTCMonth();
        if (!sameMonth) {
          await supabase.from("profiles").update({
            documents_used_this_month: 0,
            usage_period_start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10),
          }).eq("id", userId);
          profile.documents_used_this_month = 0;
        }
        const limit = PLAN_LIMITS[profile.plan as keyof typeof PLAN_LIMITS] ?? 5;

        // For team plan, count usage across all team members
        let totalUsed = profile.documents_used_this_month;
        if (profile.team_id) {
          const { data: teamProfiles } = await supabaseAdmin
            .from("profiles")
            .select("documents_used_this_month")
            .eq("team_id", profile.team_id)
            .neq("id", userId);
          const otherUsed = (teamProfiles ?? []).reduce((sum: number, p: any) => sum + (p.documents_used_this_month ?? 0), 0);
          totalUsed += otherUsed;
        }

        if (totalUsed >= limit) {
          await supabase.from("documents").update({
            status: "error",
            error_message: `Monthly limit reached (${limit} documents on ${profile.plan} plan).`,
          }).eq("id", doc.id);
          throw new Error(`Monthly limit reached. Upgrade to process more documents.`);
        }
      }

      // Download file via admin to get bytes
      const dl = await supabaseAdmin.storage.from("documents").download(doc.file_path);
      if (dl.error || !dl.data) throw new Error("Failed to load file");
      const ab = await dl.data.arrayBuffer();
      const base64 = Buffer.from(ab).toString("base64");
      const mime = doc.mime_type || dl.data.type || "image/jpeg";

      // Call Anthropic Claude for extraction
      if (!process.env.ANTHROPIC_API_KEY) throw new Error("AI service not configured");
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const isPdf = mime === "application/pdf";
      const imageMediaType = (mime.startsWith("image/") ? mime : "image/jpeg") as
        | "image/jpeg" | "image/png" | "image/gif" | "image/webp";

      const systemPrompt = `You are a document data extraction engine. Extract structured data from the provided invoice, receipt, or purchase order.

Return ONLY a valid JSON object with this exact structure — no markdown, no explanation, nothing else:
{
  "document_type": "invoice | receipt | purchase_order | other",
  "vendor_name": "string or null",
  "invoice_number": "string or null",
  "invoice_date": "YYYY-MM-DD or null",
  "due_date": "YYYY-MM-DD or null",
  "currency": "ISO 4217 3-letter code or null",
  "subtotal": number or null,
  "tax_amount": number or null,
  "total_amount": number or null,
  "overall_confidence": 0.0 to 1.0,
  "confidence": {
    "vendor_name": "high | medium | low",
    "invoice_number": "high | medium | low",
    "invoice_date": "high | medium | low",
    "total_amount": "high | medium | low"
  },
  "line_items": [
    {
      "description": "string",
      "quantity": number or null,
      "unit_price": number or null,
      "line_total": number or null,
      "confidence": "high | medium | low"
    }
  ]
}`;

      const documentContent = isPdf
        ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 } }
        : { type: "image" as const, source: { type: "base64" as const, media_type: imageMediaType, data: base64 } };

      const aiRes = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              documentContent,
              { type: "text", text: "Extract all fields and line items from this document." },
            ],
          },
        ],
      });

      const textBlock = aiRes.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") throw new Error("AI returned no text");
      const rawText = textBlock.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const rawArgs = JSON.parse(rawText);
      const parsed = ExtractedSchema.parse(rawArgs);

      // Use model's overall_confidence if provided, else average per-field confidence
      const confMap: Record<string, number> = { high: 1, medium: 0.66, low: 0.33 };
      const confs = Object.values(parsed.confidence || {});
      const confScore = parsed.overall_confidence ??
        (confs.length
          ? confs.reduce((a, b: string) => a + (confMap[b] ?? 0.5), 0) / confs.length
          : 0.5);

      // Write extracted_data
      await supabase.from("extracted_data").upsert({
        document_id: doc.id,
        vendor_name: parsed.vendor_name ?? null,
        invoice_number: parsed.invoice_number ?? null,
        invoice_date: parsed.invoice_date ?? null,
        due_date: parsed.due_date ?? null,
        currency: parsed.currency ?? null,
        subtotal: parsed.subtotal ?? null,
        tax_amount: parsed.tax_amount ?? null,
        total_amount: parsed.total_amount ?? null,
        confidence_score: confScore,
        confidence_fields: parsed.confidence ?? {},
        raw_extraction_json: rawArgs,
      }, { onConflict: "document_id" });

      // Replace line_items
      await supabase.from("line_items").delete().eq("document_id", doc.id);
      const items = (parsed.line_items ?? []).map((li, i) => ({
        document_id: doc.id,
        position: i,
        description: li.description ?? null,
        quantity: li.quantity ?? null,
        unit_price: li.unit_price ?? null,
        line_total: li.line_total ?? null,
        confidence: li.confidence ?? null,
      }));
      if (items.length) await supabase.from("line_items").insert(items);

      // Duplicate detection: same vendor + same total within 30 days
      if (parsed.vendor_name && parsed.total_amount) {
        const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
        const { data: dupes } = await supabase
          .from("extracted_data")
          .select("document_id, documents!inner(user_id, created_at)")
          .eq("vendor_name", parsed.vendor_name)
          .eq("total_amount", parsed.total_amount)
          .neq("document_id", doc.id)
          .gte("documents.created_at", since)
          .limit(1);
        if (dupes && dupes.length) {
          await supabase.from("duplicate_flags").insert({
            document_id: doc.id,
            matched_document_id: dupes[0].document_id,
            match_reason: `Same vendor (${parsed.vendor_name}) and total (${parsed.total_amount}) within 30 days`,
          });
        }
      }

      // Update document + usage
      await supabase.from("documents").update({
        status: "review",
        document_type: parsed.document_type ?? "other",
        extracted_at: new Date().toISOString(),
      }).eq("id", doc.id);

      await supabase.from("profiles").upsert({
        id: userId,
        documents_used_this_month: (profile?.documents_used_this_month ?? 0) + 1,
      }, { onConflict: "id" });

      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await supabase.from("documents").update({
        status: "error",
        error_message: msg,
      }).eq("id", doc.id);
      throw err;
    }
  });
