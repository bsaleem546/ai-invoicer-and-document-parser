# DocFlow — AI Invoice & Document Parser

## Project Overview
SaaS web app that extracts structured data from invoices, receipts, and purchase orders using AI. Target users: small businesses and their accountants.

## Tech Stack
- Frontend: React + TypeScript + Tailwind CSS
- Backend: Supabase (auth, PostgreSQL, storage, edge functions — Deno/TypeScript)
- AI: Anthropic Claude API (claude-sonnet-4-20250514) via Supabase Edge Function
- Payments: Stripe
- File storage: Supabase Storage

## Bash Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run typecheck` — run TypeScript checker
- `npm run lint` — run ESLint
- `supabase start` — start local Supabase
- `supabase functions serve` — serve edge functions locally
- `supabase db push` — push schema migrations
- `supabase gen types typescript --local > src/types/supabase.ts` — regenerate DB types

## Project Structure
```
/src
  /components      — reusable UI components
  /pages           — route-level page components
  /hooks           — custom React hooks
  /lib             — supabase client, stripe client, utilities
  /types           — TypeScript types including generated Supabase types
/supabase
  /functions       — edge functions (Deno TypeScript)
    /extract-document
  /migrations      — SQL migration files
```

## Code Style
- Use ES modules (import/export), never CommonJS (require)
- Destructure imports where possible
- Functional React components only, no class components
- Always type props explicitly — no implicit `any`
- Use async/await, never raw .then() chains
- Tailwind for all styling — no inline styles, no CSS modules

## Database Rules — CRITICAL
- Every table MUST have Row Level Security (RLS) enabled
- Every RLS policy must scope to `auth.uid()` — users can only access their own data
- Never expose the service role key to the frontend — only the anon key
- All edge functions that write to the DB use the service role key server-side only

## Supabase Edge Functions
- Runtime is Deno — use Deno import syntax, not npm imports
- Import Anthropic SDK: `import Anthropic from "npm:@anthropic-ai/sdk"`
- Import Supabase client: `import { createClient } from "npm:@supabase/supabase-js"`
- Always validate the incoming request has a valid Supabase JWT before processing
- Return proper CORS headers on all functions

## Stripe
- Use Stripe Checkout for subscription creation
- Use Stripe Customer Portal for plan management
- Webhook endpoint: `/supabase/functions/stripe-webhook`
- Always verify webhook signatures — never skip this

## Plan Enforcement
- Plans: free (5 docs/mo), pro (50 docs/mo), team (500 docs/mo)
- Check `profiles.documents_used_this_month` against plan limit before processing
- Enforce in the edge function, not just on the frontend
- Return 403 with `{ error: "limit_reached" }` when over quota

## AI Extraction
- Model: claude-sonnet-4-6
- Always pass documents as base64 with correct media_type
- Extraction returns JSON only — parse and validate before writing to DB
- Write overall confidence as float 0–1 to `extracted_data.confidence_score`
- Write per-field confidence as "high" | "medium" | "low" to each line_item

## Duplicate Detection
- Run after every successful extraction
- Query: same user_id + same vendor_name + same total_amount + invoice_date within 30 days
- Write match to `duplicate_flags` table if found
- Do not block the extraction — flag and let user decide

## Testing
- Run typecheck before committing: `npm run typecheck`
- Test edge functions locally with `supabase functions serve` before deploying
- Always test RLS policies with a non-owner user to verify isolation

## When Compacting
- Always preserve: current file being worked on, RLS policies, edge function logic, Stripe webhook handler
- Always preserve: the DB schema and migration state
