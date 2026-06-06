import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js";

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

  const stripe = new Stripe(stripeKey, { apiVersion: "2026-05-27.dahlia" });
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
