import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Stripe from "stripe";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe not configured");
  return new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
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

    const appUrl = process.env.APP_URL ?? process.env.VITE_SUPABASE_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: profile?.stripe_customer_id ?? undefined,
      customer_email: profile?.stripe_customer_id ? undefined : (profile?.email ?? undefined),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/settings?upgraded=1`,
      cancel_url: `${appUrl}/settings`,
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

    if (!profile?.stripe_customer_id) throw new Error("No billing account found. Please contact support.");

    const appUrl = process.env.APP_URL ?? process.env.VITE_SUPABASE_URL ?? "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${appUrl}/settings`,
    });

    return { url: session.url };
  });
