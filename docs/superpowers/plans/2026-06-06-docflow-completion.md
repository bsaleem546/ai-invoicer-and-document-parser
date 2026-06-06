# DocFlow Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all deployment-blocking features: swap AI to Anthropic, add Stripe billing, build Settings page, build Documents list page, and add frontend plan gates.

**Architecture:** TanStack Start server functions handle extraction (Anthropic SDK) and Stripe Checkout/Portal. A Supabase edge function handles the Stripe webhook since it needs a stable public URL independent of the frontend app. Settings and Documents pages are new TanStack Router file-based routes.

**Tech Stack:** React + TanStack Start + Supabase + Anthropic SDK (`@anthropic-ai/sdk`) + Stripe (`stripe`) + Supabase Edge Functions (Deno)

---

### Task 1: Fix `.env.example` and document all required secrets

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Rewrite `.env.example`**

```
# Supabase — Settings → API in your Supabase project dashboard
VITE_SUPABASE_URL=                  # e.g. https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=      # anon/public key (sb_publishable_...)
VITE_SUPABASE_PROJECT_ID=           # Reference ID (xxxx from the URL)

# Also needed server-side (TanStack server functions read process.env)
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_PROJECT_ID=

# Stripe — dashboard.stripe.com → Developers → API keys
VITE_STRIPE_PUBLISHABLE_KEY=        # pk_live_... or pk_test_...

# --- SERVER ONLY — never put these in .env.local or expose to browser ---
# Set via: supabase secrets set KEY=value

# ANTHROPIC_API_KEY=               # console.anthropic.com → API Keys
# STRIPE_SECRET_KEY=               # sk_live_... or sk_test_...
# STRIPE_WEBHOOK_SECRET=           # whsec_... from Stripe Dashboard → Webhooks
# STRIPE_PRO_PRICE_ID=             # price_... for docflow_pro product
# STRIPE_TEAM_PRICE_ID=            # price_... for docflow_team product
# SUPABASE_SERVICE_ROLE_KEY=       # Settings → API → service_role key (NEVER in frontend)
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: update env.example with all required variables"
```

---

### Task 2: Swap AI extraction from Gemini to Anthropic Claude

**Files:**
- Modify: `src/lib/documents.functions.ts`

- [ ] **Step 1: Install Anthropic SDK**

```bash
npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Replace the AI call in `src/lib/documents.functions.ts`**

Replace the entire block from `// Call Lovable AI Gateway` through `const parsed = ExtractedSchema.parse(rawArgs);` (lines 79–161) with:

```typescript
      // Call Anthropic Claude for extraction
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      if (!process.env.ANTHROPIC_API_KEY) throw new Error("AI service not configured");

      const mediaType = (mime.startsWith("image/") ? mime : "image/jpeg") as
        | "image/jpeg" | "image/png" | "image/gif" | "image/webp";

      const aiRes = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: `You are a document data extraction engine. Extract structured data from the provided invoice, receipt, or purchase order.

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
}`,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64 },
              },
              { type: "text", text: "Extract all fields and line items from this document." },
            ],
          },
        ],
      });

      const textBlock = aiRes.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") throw new Error("AI returned no text");
      const rawArgs = JSON.parse(textBlock.text.trim());
      const parsed = ExtractedSchema.parse(rawArgs);
```

Also update `ExtractedSchema` in the same file to include `overall_confidence`:

```typescript
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
```

And update the confidence score calculation to prefer `overall_confidence` from the model:

```typescript
      // Use model's overall_confidence if provided, else average per-field confidence
      const confMap: Record<string, number> = { high: 1, medium: 0.66, low: 0.33 };
      const confs = Object.values(parsed.confidence || {});
      const confScore = parsed.overall_confidence ??
        (confs.length
          ? confs.reduce((a, b) => a + (confMap[b] ?? 0.5), 0) / confs.length
          : 0.5);
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors related to documents.functions.ts

- [ ] **Step 4: Commit**

```bash
git add src/lib/documents.functions.ts package.json package-lock.json
git commit -m "feat: swap AI extraction to Anthropic claude-sonnet-4-20250514"
```

---

### Task 3: Stripe server functions (Checkout + Customer Portal)

**Files:**
- Create: `src/lib/stripe.functions.ts`

- [ ] **Step 1: Install Stripe SDK**

```bash
npm install stripe
```

- [ ] **Step 2: Create `src/lib/stripe.functions.ts`**

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Stripe from "stripe";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe not configured");
  return new Stripe(key, { apiVersion: "2025-05-28.basil" });
}

const PRICE_IDS = {
  pro: () => process.env.STRIPE_PRO_PRICE_ID!,
  team: () => process.env.STRIPE_TEAM_PRICE_ID!,
} as const;

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { plan: "pro" | "team" }) =>
    z.object({ plan: z.enum(["pro", "team"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const stripe = getStripe();

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, email")
      .eq("id", userId)
      .maybeSingle();

    const priceId = PRICE_IDS[data.plan]();
    if (!priceId) throw new Error(`Price ID for ${data.plan} not configured`);

    const origin = process.env.VITE_SUPABASE_URL
      ? new URL(process.env.VITE_SUPABASE_URL).origin
      : "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: profile?.stripe_customer_id ?? undefined,
      customer_email: profile?.stripe_customer_id ? undefined : (profile?.email ?? undefined),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/settings?upgraded=1`,
      cancel_url: `${origin}/settings`,
      metadata: { user_id: userId, plan: data.plan },
      subscription_data: { metadata: { user_id: userId } },
    });

    return { url: session.url! };
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const stripe = getStripe();

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.stripe_customer_id) throw new Error("No billing account found");

    const origin = process.env.VITE_SUPABASE_URL
      ? new URL(process.env.VITE_SUPABASE_URL).origin
      : "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/settings`,
    });

    return { url: session.url };
  });
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors in stripe.functions.ts

- [ ] **Step 4: Commit**

```bash
git add src/lib/stripe.functions.ts package.json package-lock.json
git commit -m "feat: add Stripe checkout and portal server functions"
```

---

### Task 4: Stripe webhook Supabase edge function

**Files:**
- Create: `supabase/functions/stripe-webhook/index.ts`

- [ ] **Step 1: Create `supabase/functions/stripe-webhook/index.ts`**

```typescript
import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js";

const PLAN_MAP: Record<string, string> = {};

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!stripeKey || !webhookSecret || !supabaseUrl || !serviceKey) {
    return new Response("Server misconfigured", { status: 500, headers: corsHeaders });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-05-28.basil" });
  const supabase = createClient(supabaseUrl, serviceKey);

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400, headers: corsHeaders });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400, headers: corsHeaders });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const plan = session.metadata?.plan;
      if (userId && plan) {
        await supabase.from("profiles").update({
          plan,
          stripe_customer_id: session.customer as string,
        }).eq("id", userId);
      }
    }

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id;
      if (!userId) return new Response("ok", { status: 200, headers: corsHeaders });

      const priceId = sub.items.data[0]?.price.id;
      const proPriceId = Deno.env.get("STRIPE_PRO_PRICE_ID");
      const teamPriceId = Deno.env.get("STRIPE_TEAM_PRICE_ID");

      let plan = "free";
      if (priceId === proPriceId) plan = "pro";
      else if (priceId === teamPriceId) plan = "team";

      if (sub.status === "active" || sub.status === "trialing") {
        await supabase.from("profiles").update({ plan }).eq("id", userId);
      } else {
        await supabase.from("profiles").update({ plan: "free" }).eq("id", userId);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id;
      if (userId) {
        await supabase.from("profiles").update({ plan: "free" }).eq("id", userId);
      }
    }
  } catch (err) {
    console.error("Error processing webhook:", err);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/stripe-webhook/index.ts
git commit -m "feat: add stripe-webhook Supabase edge function"
```

- [ ] **Step 3: Document deployment steps (in commit message or README)**

After deploying, set secrets:
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set STRIPE_PRO_PRICE_ID=price_...
supabase secrets set STRIPE_TEAM_PRICE_ID=price_...
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
```

Deploy the function:
```bash
supabase functions deploy stripe-webhook
```

Then add the function URL as a webhook endpoint in Stripe Dashboard → Developers → Webhooks:
- URL: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

---

### Task 5: Build `/documents` list page

**Files:**
- Create: `src/routes/_authenticated/documents.tsx`

- [ ] **Step 1: Create `src/routes/_authenticated/documents.tsx`**

```typescript
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, AlertCircle, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/documents")({
  component: DocumentsList,
});

const STATUS_OPTIONS = ["all", "processing", "review", "exported", "error"] as const;
const TYPE_OPTIONS = ["all", "invoice", "receipt", "purchase_order", "other"] as const;

function DocumentsList() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("all");
  const [type, setType] = useState<(typeof TYPE_OPTIONS)[number]>("all");

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents-list", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("*, extracted_data(vendor_name, total_amount, currency, invoice_number, invoice_date)")
        .order("created_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
    refetchInterval: (q) => {
      const data = q.state.data as any[] | undefined;
      return data?.some((d) => d.status === "processing") ? 2000 : false;
    },
  });

  const filtered = (documents ?? []).filter((d: any) => {
    const ed = Array.isArray(d.extracted_data) ? d.extracted_data[0] : d.extracted_data;
    if (status !== "all" && d.status !== status) return false;
    if (type !== "all" && d.document_type !== type) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        d.file_name.toLowerCase().includes(q) ||
        (ed?.vendor_name ?? "").toLowerCase().includes(q) ||
        (ed?.invoice_number ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">Full history of all uploaded documents.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by file, vendor, invoice #..."
            className="w-full rounded-md border border-border bg-surface pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === "all" ? "All statuses" : s}</option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{t === "all" ? "All types" : t.replace("_", " ")}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-surface" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            {search || status !== "all" || type !== "all" ? "No documents match your filters." : "No documents yet."}
          </p>
          {!search && status === "all" && type === "all" && (
            <Link to="/dashboard" className="mt-3 inline-block text-sm text-primary hover:underline">
              Upload your first document →
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="data-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Type</th>
                <th>Vendor</th>
                <th>Invoice #</th>
                <th>Date</th>
                <th className="text-right">Total</th>
                <th>Uploaded</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d: any) => {
                const ed = Array.isArray(d.extracted_data) ? d.extracted_data[0] : d.extracted_data;
                return (
                  <tr
                    key={d.id}
                    onClick={() => d.status !== "processing" && navigate({ to: "/documents/$id", params: { id: d.id } })}
                    className={d.status !== "processing" ? "cursor-pointer" : ""}
                  >
                    <td className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate max-w-[220px]">{d.file_name}</span>
                    </td>
                    <td className="font-mono text-xs uppercase text-muted-foreground">
                      {d.document_type?.replace("_", " ") ?? "—"}
                    </td>
                    <td>{ed?.vendor_name ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="font-mono text-xs">{ed?.invoice_number ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="font-mono text-xs text-muted-foreground">{ed?.invoice_date ?? "—"}</td>
                    <td className="text-right font-mono text-sm">
                      {ed?.total_amount != null
                        ? `${ed.currency ?? ""} ${Number(ed.total_amount).toFixed(2)}`.trim()
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="font-mono text-xs text-muted-foreground">
                      {new Date(d.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-2 font-mono text-xs uppercase">
                        <span className={`status-dot ${d.status}`} />
                        {d.status}
                        {d.status === "error" && <AlertCircle className="h-3 w-3 text-destructive" />}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            {filtered.length} document{filtered.length !== 1 ? "s" : ""}
            {(search || status !== "all" || type !== "all") && ` (filtered from ${documents?.length ?? 0})`}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/routes/_authenticated/documents.tsx
git commit -m "feat: add /documents list page with search and filters"
```

---

### Task 6: Build `/settings` page (profile + billing)

**Files:**
- Create: `src/routes/_authenticated/settings.tsx`

- [ ] **Step 1: Create `src/routes/_authenticated/settings.tsx`**

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createCheckoutSession, createPortalSession } from "@/lib/stripe.functions";
import { toast } from "sonner";
import { User, CreditCard, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

const PLANS = [
  {
    id: "free" as const,
    name: "Free",
    price: "$0",
    docs: "30 docs/mo",
    features: ["CSV & JSON export", "Confidence indicators", "Line item extraction"],
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$59/mo",
    docs: "500 docs/mo",
    features: ["Everything in Free", "Duplicate detection", "QuickBooks & Xero (coming soon)", "Zapier webhook (coming soon)"],
  },
  {
    id: "team" as const,
    name: "Team",
    price: "$99/mo",
    docs: "2,000 docs/mo",
    features: ["Everything in Pro", "5 seats", "Spend analytics (coming soon)", "API access (coming soon)"],
  },
];

type Tab = "profile" | "billing";

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("profile");
  const checkoutFn = useServerFn(createCheckoutSession);
  const portalFn = useServerFn(createPortalSession);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  // Check for ?upgraded=1 param and show success toast
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const justUpgraded = searchParams.get("upgraded") === "1";
  if (justUpgraded && typeof window !== "undefined") {
    window.history.replaceState({}, "", "/settings");
    toast.success("Plan upgraded successfully!");
    queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
  }

  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveProfile() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName || profile?.full_name })
      .eq("id", user.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Profile saved");
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    }
    setSaving(false);
  }

  async function handleUpgrade(plan: "pro" | "team") {
    try {
      const { url } = await checkoutFn({ data: { plan } });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start checkout");
    }
  }

  async function handleManageBilling() {
    try {
      const { url } = await portalFn({ data: {} });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open billing portal");
    }
  }

  if (isLoading) return <div className="h-32 animate-pulse rounded bg-surface" />;

  const currentPlan = profile?.plan ?? "free";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account and subscription.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["profile", "billing"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "profile" ? <User className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
            {t}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="rounded-lg border border-border bg-surface p-6 space-y-4">
          <h2 className="font-display text-lg font-bold">Profile</h2>
          <div>
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Email</span>
              <input
                value={user.email ?? ""}
                disabled
                className="w-full rounded-md border border-border bg-background/50 px-3.5 py-2 text-sm text-muted-foreground"
              />
            </label>
          </div>
          <div>
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Full name</span>
              <input
                value={fullName || profile?.full_name || ""}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="w-full rounded-md border border-border bg-background px-3.5 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </label>
          </div>
          <button
            onClick={saveProfile}
            disabled={saving}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      )}

      {tab === "billing" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-surface p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current plan</p>
              <p className="font-display text-xl font-bold capitalize">{currentPlan}</p>
            </div>
            {currentPlan !== "free" && (
              <button
                onClick={handleManageBilling}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-elevated"
              >
                Manage subscription
              </button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {PLANS.map((plan) => {
              const isCurrent = plan.id === currentPlan;
              const isDowngrade = ["free", "pro"].indexOf(plan.id) < ["free", "pro"].indexOf(currentPlan);
              return (
                <div
                  key={plan.id}
                  className={`rounded-lg border p-5 ${
                    isCurrent ? "border-primary bg-primary/5" : "border-border bg-surface"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-display font-bold">{plan.name}</p>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">{plan.docs}</p>
                    </div>
                    <p className="font-mono text-sm font-bold">{plan.price}</p>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    {isCurrent ? (
                      <div className="rounded-md border border-primary/40 px-3 py-2 text-center text-xs font-medium text-primary">
                        Current plan
                      </div>
                    ) : plan.id === "free" ? (
                      <div className="rounded-md border border-border px-3 py-2 text-center text-xs text-muted-foreground">
                        Downgrade via manage subscription
                      </div>
                    ) : (
                      <button
                        onClick={() => handleUpgrade(plan.id)}
                        className="btn-primary w-full text-sm"
                      >
                        Upgrade to {plan.name}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/routes/_authenticated/settings.tsx
git commit -m "feat: add settings page with profile and billing tabs"
```

---

### Task 7: Wire nav + plan gates

**Files:**
- Modify: `src/routes/_authenticated/route.tsx`
- Modify: `src/routes/_authenticated/documents.$id.tsx`

- [ ] **Step 1: Update nav in `src/routes/_authenticated/route.tsx`**

Replace the `<nav>` block (lines 50–53) with:

```tsx
          <nav className="hidden gap-1 md:flex">
            <NavLink to="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />}>Dashboard</NavLink>
            <NavLink to="/documents" icon={<FileText className="h-4 w-4" />}>Documents</NavLink>
          </nav>
```

Replace the Settings button (lines 58–64) with:

```tsx
            <Link
              to="/settings"
              className="rounded-md p-2 text-muted-foreground hover:bg-surface hover:text-foreground"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </Link>
```

Add `Link` to the imports at the top (it's already imported).

- [ ] **Step 2: Gate QuickBooks button in `documents.$id.tsx`**

Replace the QuickBooks button (lines 143–147) with a plan-aware version. First, the Review page already has access to `data` which doesn't include the profile. We need to read the plan from the profile query. Add this near the top of `ReviewPage`:

```tsx
  const { user } = Route.useRouteContext();
  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle();
      return data;
    },
  });
  const plan = profile?.plan ?? "free";
  const isPro = plan === "pro" || plan === "team";
```

Replace the QuickBooks button with:

```tsx
          {isPro ? (
            <button
              onClick={() => toast.info("QuickBooks integration coming soon")}
              className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-surface"
            >
              Push to QuickBooks
            </button>
          ) : (
            <button
              onClick={() => toast.info("Upgrade to Pro to unlock QuickBooks sync")}
              className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground opacity-50"
              title="Pro plan required"
            >
              Push to QuickBooks 🔒
            </button>
          )}
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/routes/_authenticated/route.tsx src/routes/_authenticated/documents.$id.tsx
git commit -m "feat: wire settings/documents nav links and add Pro plan gate on QuickBooks"
```

---

## Deployment Checklist

After all tasks:

- [ ] `npm run build` passes with no errors
- [ ] Set all Supabase edge function secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `STRIPE_TEAM_PRICE_ID`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `supabase functions deploy stripe-webhook`
- [ ] Add Stripe webhook endpoint in dashboard pointing to `https://<project>.supabase.co/functions/v1/stripe-webhook`
- [ ] Create `docflow_pro` ($59/mo) and `docflow_team` ($99/mo) products in Stripe, copy price IDs into secrets
- [ ] Set `ANTHROPIC_API_KEY` as server env var (for TanStack server functions, this goes in your hosting provider's env vars — Cloudflare Workers env vars or equivalent)
- [ ] Test extraction with a real invoice image end-to-end
- [ ] Test Stripe Checkout flow in test mode
