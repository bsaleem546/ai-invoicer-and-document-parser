import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
    features: [
      "CSV & JSON export",
      "Confidence indicators",
      "Line item extraction",
    ],
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$59/mo",
    docs: "500 docs/mo",
    features: [
      "Everything in Free",
      "Duplicate detection",
      "QuickBooks & Xero (coming soon)",
      "Zapier webhook (coming soon)",
    ],
  },
  {
    id: "team" as const,
    name: "Team",
    price: "$99/mo",
    docs: "2,000 docs/mo",
    features: [
      "Everything in Pro",
      "5 seats",
      "Spend analytics (coming soon)",
      "API access (coming soon)",
    ],
  },
];

type Tab = "profile" | "billing";

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("profile");
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  const checkoutFn = useServerFn(createCheckoutSession);
  const portalFn = useServerFn(createPortalSession);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (profile?.full_name && !fullName) setFullName(profile.full_name);
  }, [profile?.full_name]);

  // Show success toast if redirected back from Stripe Checkout
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") === "1") {
      window.history.replaceState({}, "", "/settings");
      toast.success("Plan upgraded successfully!");
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      setTab("billing");
    }
  }, []);

  async function saveProfile() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", user.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Profile saved");
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    }
    setSaving(false);
  }

  async function handleUpgrade(plan: "pro" | "team") {
    setCheckingOut(plan);
    try {
      const { url } = await checkoutFn({ data: { plan } });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start checkout");
      setCheckingOut(null);
    }
  }

  async function handleManageBilling() {
    setOpeningPortal(true);
    try {
      const { url } = await portalFn({});
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open billing portal");
      setOpeningPortal(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-surface" />
        ))}
      </div>
    );
  }

  const currentPlan = profile?.plan ?? "free";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account and subscription.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["profile", "billing"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
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
        <div className="rounded-lg border border-border bg-surface p-6 space-y-5">
          <h2 className="font-display text-lg font-bold">Profile</h2>
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Email
            </span>
            <input
              value={user.email ?? ""}
              disabled
              className="w-full rounded-md border border-border bg-background/50 px-3.5 py-2 text-sm text-muted-foreground"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Full name
            </span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              className="w-full rounded-md border border-border bg-background px-3.5 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
            />
          </label>
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
          {/* Current plan summary */}
          <div className="rounded-lg border border-border bg-surface p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-mono uppercase text-muted-foreground">Current plan</p>
              <p className="font-display text-xl font-bold capitalize mt-0.5">{currentPlan}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {profile?.documents_used_this_month ?? 0} /{" "}
                {{ free: 30, pro: 500, team: 2000 }[currentPlan]} docs used this month
              </p>
            </div>
            {currentPlan !== "free" && (
              <button
                onClick={handleManageBilling}
                disabled={openingPortal}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-elevated disabled:opacity-50"
              >
                {openingPortal ? "Opening..." : "Manage subscription"}
              </button>
            )}
          </div>

          {/* Plan cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {PLANS.map((plan) => {
              const isCurrent = plan.id === currentPlan;
              return (
                <div
                  key={plan.id}
                  className={`rounded-lg border p-5 flex flex-col ${
                    isCurrent
                      ? "border-primary bg-primary/5"
                      : "border-border bg-surface"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-display font-bold">{plan.name}</p>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">{plan.docs}</p>
                    </div>
                    <p className="font-mono text-sm font-bold">{plan.price}</p>
                  </div>
                  <ul className="mt-4 space-y-2 flex-1">
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
                        Cancel via manage subscription
                      </div>
                    ) : (
                      <button
                        onClick={() => handleUpgrade(plan.id)}
                        disabled={checkingOut === plan.id}
                        className="btn-primary w-full text-sm disabled:opacity-50"
                      >
                        {checkingOut === plan.id ? "Redirecting..." : `Upgrade to ${plan.name}`}
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
