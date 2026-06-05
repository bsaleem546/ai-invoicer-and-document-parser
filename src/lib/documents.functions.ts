import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PLAN_LIMITS = { free: 30, pro: 500, team: 2000 } as const;

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
        .select("plan, documents_used_this_month, usage_period_start")
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
        const limit = PLAN_LIMITS[profile.plan as keyof typeof PLAN_LIMITS] ?? 30;
        if (profile.documents_used_this_month >= limit) {
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

      // Call Lovable AI Gateway with vision + tool calling
      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) throw new Error("AI service not configured");

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "You are a document extraction engine. Extract all structured data from invoices, receipts, and purchase orders. Always call the extract_invoice function.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Extract all fields and line items from this document." },
                { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
              ],
            },
          ],
          tools: [{
            type: "function",
            function: {
              name: "extract_invoice",
              description: "Return structured invoice data",
              parameters: {
                type: "object",
                properties: {
                  document_type: { type: "string", enum: ["invoice", "receipt", "purchase_order", "other"] },
                  vendor_name: { type: "string" },
                  invoice_number: { type: "string" },
                  invoice_date: { type: "string", description: "YYYY-MM-DD" },
                  due_date: { type: "string", description: "YYYY-MM-DD" },
                  currency: { type: "string", description: "3-letter ISO" },
                  subtotal: { type: "number" },
                  tax_amount: { type: "number" },
                  total_amount: { type: "number" },
                  confidence: {
                    type: "object",
                    properties: {
                      vendor_name: { type: "string", enum: ["high", "medium", "low"] },
                      invoice_number: { type: "string", enum: ["high", "medium", "low"] },
                      invoice_date: { type: "string", enum: ["high", "medium", "low"] },
                      total_amount: { type: "string", enum: ["high", "medium", "low"] },
                    },
                  },
                  line_items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        description: { type: "string" },
                        quantity: { type: "number" },
                        unit_price: { type: "number" },
                        line_total: { type: "number" },
                        confidence: { type: "string", enum: ["high", "medium", "low"] },
                      },
                    },
                  },
                },
                required: ["document_type"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "extract_invoice" } },
        }),
      });

      if (!aiRes.ok) {
        const errText = await aiRes.text();
        console.error("AI gateway error:", aiRes.status, errText);
        if (aiRes.status === 429) throw new Error("Rate limit reached. Try again shortly.");
        if (aiRes.status === 402) throw new Error("AI credits exhausted. Please add credits.");
        throw new Error("AI extraction failed");
      }

      const aiJson = await aiRes.json();
      const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error("AI returned no structured data");
      const rawArgs = JSON.parse(toolCall.function.arguments);
      const parsed = ExtractedSchema.parse(rawArgs);

      // Compute overall confidence
      const confMap: Record<string, number> = { high: 1, medium: 0.66, low: 0.33 };
      const confs = Object.values(parsed.confidence || {});
      const confScore = confs.length
        ? confs.reduce((a, b) => a + (confMap[b] ?? 0.5), 0) / confs.length
        : 0.5;

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

      if (profile) {
        await supabase.from("profiles").update({
          documents_used_this_month: (profile.documents_used_this_month ?? 0) + 1,
        }).eq("id", userId);
      }

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
