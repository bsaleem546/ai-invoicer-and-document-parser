# DocFlow — Full Project Instructions

Reference this file when starting a new feature or when Claude needs full context on a specific part of the system.

---

## Database Schema

### `profiles`
```sql
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  plan text default 'free' check (plan in ('free', 'pro', 'team')),
  stripe_customer_id text,
  documents_used_this_month int default 0,
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
```

### `documents`
```sql
create table documents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  file_name text not null,
  file_url text not null,
  status text default 'processing' check (status in ('processing', 'review', 'exported', 'error')),
  document_type text default 'other' check (document_type in ('invoice', 'receipt', 'purchase_order', 'other')),
  extracted_at timestamptz,
  created_at timestamptz default now()
);
alter table documents enable row level security;
create policy "Users can CRUD own documents" on documents for all using (auth.uid() = user_id);
```

### `extracted_data`
```sql
create table extracted_data (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references documents on delete cascade not null,
  vendor_name text,
  invoice_number text,
  invoice_date date,
  due_date date,
  currency text,
  subtotal numeric,
  tax_amount numeric,
  total_amount numeric,
  confidence_score float,
  raw_extraction_json jsonb,
  user_edited boolean default false
);
alter table extracted_data enable row level security;
create policy "Users can access own extracted data" on extracted_data for all
  using (auth.uid() = (select user_id from documents where id = document_id));
```

### `line_items`
```sql
create table line_items (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references documents on delete cascade not null,
  description text,
  quantity numeric,
  unit_price numeric,
  line_total numeric,
  confidence text check (confidence in ('high', 'medium', 'low'))
);
alter table line_items enable row level security;
create policy "Users can access own line items" on line_items for all
  using (auth.uid() = (select user_id from documents where id = document_id));
```

### `duplicate_flags`
```sql
create table duplicate_flags (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references documents on delete cascade not null,
  matched_document_id uuid references documents on delete cascade not null,
  match_reason text,
  dismissed boolean default false
);
alter table duplicate_flags enable row level security;
create policy "Users can access own flags" on duplicate_flags for all
  using (auth.uid() = (select user_id from documents where id = document_id));
```

---

## Edge Function: `extract-document`

**File:** `supabase/functions/extract-document/index.ts`

**Flow:**
1. Validate Bearer token (Supabase JWT)
2. Parse body: `{ document_id: string }`
3. Fetch document row — verify it belongs to the authenticated user
4. Check plan limit — return 403 if over quota
5. Download file from Supabase Storage as ArrayBuffer
6. Convert to base64
7. Call Claude API with vision + extraction prompt
8. Parse JSON response
9. Write to `extracted_data` table
10. Write each line item to `line_items` table
11. Run duplicate check — write to `duplicate_flags` if match found
12. Update `documents.status` to `review`, set `extracted_at`
13. Increment `profiles.documents_used_this_month`
14. Return `{ success: true, document_id }`

**Claude extraction prompt (system):**
```
You are a document data extraction engine. Extract structured data from the provided invoice, receipt, or purchase order.

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
}
```

---

## Pages & Routes

| Route | Component | Description |
|---|---|---|
| `/` | `LandingPage` | Marketing page with pricing |
| `/login` | `LoginPage` | Supabase Auth email + Google |
| `/signup` | `SignupPage` | Supabase Auth email + Google |
| `/dashboard` | `Dashboard` | Upload zone + recent documents |
| `/documents` | `DocumentsList` | Full searchable document history |
| `/documents/:id` | `DocumentReview` | Split view: file viewer + extracted data |
| `/settings` | `Settings` | Profile, integrations, billing, API tab |

All routes except `/`, `/login`, `/signup` require authentication. Redirect to `/login` if no session.

---

## Plan Feature Gates

| Feature | Free | Pro | Team |
|---|---|---|---|
| Documents/month | 30 | 500 | 2,000 |
| Line item extraction | ✓ | ✓ | ✓ |
| Export CSV / JSON | ✓ | ✓ | ✓ |
| Confidence indicators | ✓ | ✓ | ✓ |
| Duplicate detection | — | ✓ | ✓ |
| QuickBooks / Xero sync | — | ✓ | ✓ |
| Zapier webhook | — | ✓ | ✓ |
| Spend analytics | — | — | ✓ |
| Multi-user seats | 1 | 1 | 5 |
| API access | — | — | ✓ |

Gate logic lives in the edge function AND in the frontend. Never rely on frontend-only gating for anything that costs money or API calls.

---

## Stripe Integration

### Products to create in Stripe Dashboard
- `docflow_pro` — $59/month recurring
- `docflow_team` — $99/month recurring

### Webhooks to handle
- `checkout.session.completed` — update `profiles.plan` and `profiles.stripe_customer_id`
- `customer.subscription.updated` — handle plan changes
- `customer.subscription.deleted` — downgrade to free

### Edge Function: `stripe-webhook`
Always verify signature:
```typescript
const signature = req.headers.get('stripe-signature')
const event = stripe.webhooks.constructEvent(body, signature, Deno.env.get('STRIPE_WEBHOOK_SECRET'))
```

---

## Environment Variables

### Frontend (`.env.local`)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
```

### Supabase Edge Functions (set via `supabase secrets set`)
```
ANTHROPIC_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
SUPABASE_SERVICE_ROLE_KEY=
```

Never put the service role key or Anthropic API key in the frontend. Never. If Lovable or any tool suggests this, reject it.

---

## Design Tokens

```css
--color-bg: #0A0A0F;
--color-surface: #111118;
--color-border: #1E1E2A;
--color-text-primary: #F0EEE8;
--color-text-muted: #6B6B7A;
--color-accent: #00FF87;
--color-accent-dim: #00CC6A;
--color-warning: #FFB547;
--color-error: #FF4D4D;
--font-display: 'Syne', sans-serif;
--font-body: 'DM Sans', sans-serif;
--font-mono: 'JetBrains Mono', monospace;
```

Google Fonts import:
```
https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap
```

---

## Key UX Rules

- Upload feedback within 200ms of file drop — show filename and progress immediately
- Extraction loading state: skeleton loader in right panel, not a spinner
- Inline field editing: click to edit, Enter or blur to save — no separate edit mode
- Confidence dots: green = high, yellow = medium, red = low — next to every field label
- Duplicate banner: yellow, top of review page, shows matched invoice details, dismissable
- Over-quota: show upgrade modal immediately — never silently fail or show a generic error
- Empty dashboard: large dashed upload zone, no empty table state

---

## Out of Scope for v1

Do not build these. If asked, respond with a "coming soon" toast:
- Mobile app
- Live QuickBooks / Xero OAuth (placeholder buttons only)
- Email ingestion
- Custom model training
- White-label / multi-tenant
- Team member invite flow (UI only, no backend)
