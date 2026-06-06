import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createCheckoutSession, createPortalSession } from "@/lib/stripe.functions";
import { getTeam, createTeam, inviteMember, removeMember } from "@/lib/team.functions";
import { toast } from "sonner";
import { User, CreditCard, Check, Users, X, Mail, Crown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

const PLANS = [
  {
    id: "free" as const,
    name: "Free",
    price: "$0",
    docs: "5 docs/mo",
    features: [
      "CSV & JSON export",
      "Confidence indicators",
      "Line item extraction",
    ],
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$24.99/mo",
    docs: "50 docs/mo",
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
    price: "$34.99/mo",
    docs: "500 docs/mo",
    features: [
      "Everything in Pro",
      "5 seats",
      "Shared documents & quota",
      "Spend analytics (coming soon)",
      "API access (coming soon)",
    ],
  },
];

const MAX_SEATS = 5;
type Tab = "profile" | "billing" | "team";

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("profile");
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const checkoutFn = useServerFn(createCheckoutSession);
  const portalFn = useServerFn(createPortalSession);
  const getTeamFn = useServerFn(getTeam);
  const createTeamFn = useServerFn(createTeam);
  const inviteFn = useServerFn(inviteMember);
  const removeFn = useServerFn(removeMember);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ["team", user.id],
    queryFn: () => getTeamFn({}),
    enabled: profile?.plan === "team",
  });

  useEffect(() => {
    if (profile?.full_name && !fullName) setFullName(profile.full_name);
  }, [profile?.full_name]);

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
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
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

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!teamName.trim()) return;
    setCreatingTeam(true);
    try {
      await createTeamFn({ data: { name: teamName.trim() } });
      toast.success("Team created!");
      queryClient.invalidateQueries({ queryKey: ["team", user.id] });
      setTeamName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setCreatingTeam(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await inviteFn({ data: { email: inviteEmail.trim() } });
      toast.success(`Invite sent to ${inviteEmail}`);
      queryClient.invalidateQueries({ queryKey: ["team", user.id] });
      setInviteEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(memberId: string) {
    setRemoving(memberId);
    try {
      await removeFn({ data: { memberId } });
      toast.success("Member removed");
      queryClient.invalidateQueries({ queryKey: ["team", user.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setRemoving(null);
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
  const isTeamPlan = currentPlan === "team";
  const team = teamData?.team as any;
  const teamMembers = (team?.team_members ?? []) as any[];
  const isOwner = teamData?.role === "owner";
  const slotsUsed = teamMembers.length;
  const slotsLeft = MAX_SEATS - slotsUsed;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "profile", label: "Profile", icon: <User className="h-4 w-4" /> },
    { id: "billing", label: "Billing", icon: <CreditCard className="h-4 w-4" /> },
    ...(isTeamPlan ? [{ id: "team" as Tab, label: "Team", icon: <Users className="h-4 w-4" /> }] : []),
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account and subscription.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
              tab === t.id
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === "profile" && (
        <div className="rounded-lg border border-border bg-surface p-6 space-y-5">
          <h2 className="font-display text-lg font-bold">Profile</h2>
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Email</span>
            <input value={user.email ?? ""} disabled className="w-full rounded-md border border-border bg-background/50 px-3.5 py-2 text-sm text-muted-foreground" />
          </label>
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Full name</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              className="w-full rounded-md border border-border bg-background px-3.5 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
            />
          </label>
          <button onClick={saveProfile} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      )}

      {/* Billing tab */}
      {tab === "billing" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-surface p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-mono uppercase text-muted-foreground">Current plan</p>
              <p className="font-display text-xl font-bold capitalize mt-0.5">{currentPlan}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {profile?.documents_used_this_month ?? 0} / {{ free: 5, pro: 50, team: 500 }[currentPlan]} docs used this month
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

          <div className="grid gap-4 sm:grid-cols-3">
            {PLANS.map((plan) => {
              const isCurrent = plan.id === currentPlan;
              return (
                <div key={plan.id} className={`rounded-lg border p-5 flex flex-col ${isCurrent ? "border-primary bg-primary/5" : "border-border bg-surface"}`}>
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
                        <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" /> {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    {isCurrent ? (
                      <div className="rounded-md border border-primary/40 px-3 py-2 text-center text-xs font-medium text-primary">Current plan</div>
                    ) : plan.id === "free" ? (
                      <div className="rounded-md border border-border px-3 py-2 text-center text-xs text-muted-foreground">Cancel via manage subscription</div>
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

      {/* Team tab */}
      {tab === "team" && (
        <div className="space-y-6">
          {teamLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-surface" />)}
            </div>
          ) : !team ? (
            /* Create team */
            <div className="rounded-lg border border-border bg-surface p-6">
              <h2 className="font-display text-lg font-bold">Create your team</h2>
              <p className="mt-1 text-sm text-muted-foreground">Set up your team to invite up to 4 members and share documents.</p>
              <form onSubmit={handleCreateTeam} className="mt-4 flex gap-3">
                <input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Team name"
                  required
                  className="flex-1 rounded-md border border-border bg-background px-3.5 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                />
                <button type="submit" disabled={creatingTeam} className="btn-primary disabled:opacity-50">
                  {creatingTeam ? "Creating..." : "Create team"}
                </button>
              </form>
            </div>
          ) : (
            <>
              {/* Team header */}
              <div className="rounded-lg border border-border bg-surface p-4 flex items-center justify-between">
                <div>
                  <p className="font-display text-lg font-bold">{team.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{slotsUsed} / {MAX_SEATS} seats used</p>
                </div>
                <div className="flex gap-1">
                  {[...Array(MAX_SEATS)].map((_, i) => (
                    <div key={i} className={`h-2 w-6 rounded-full ${i < slotsUsed ? "bg-primary" : "bg-border"}`} />
                  ))}
                </div>
              </div>

              {/* Members list */}
              <div className="rounded-lg border border-border bg-surface overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <p className="font-mono text-xs uppercase text-muted-foreground">Members</p>
                </div>
                <ul className="divide-y divide-border">
                  {teamMembers.map((m: any) => (
                    <li key={m.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-surface-elevated flex items-center justify-center text-xs font-medium">
                          {(m.invited_email || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm">{m.invited_email || "—"}</p>
                          <p className="text-xs text-muted-foreground font-mono uppercase">{m.role} · {m.status}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {m.role === "owner" && <Crown className="h-3.5 w-3.5 text-warning" />}
                        {isOwner && m.role !== "owner" && (
                          <button
                            onClick={() => handleRemove(m.id)}
                            disabled={removing === m.id}
                            className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                            title="Remove member"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Invite form */}
              {isOwner && slotsLeft > 0 && (
                <div className="rounded-lg border border-border bg-surface p-4">
                  <p className="font-mono text-xs uppercase text-muted-foreground mb-3">Invite member ({slotsLeft} slot{slotsLeft !== 1 ? "s" : ""} left)</p>
                  <form onSubmit={handleInvite} className="flex gap-3">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="colleague@company.com"
                        required
                        className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                      />
                    </div>
                    <button type="submit" disabled={inviting} className="btn-primary disabled:opacity-50">
                      {inviting ? "Sending..." : "Send invite"}
                    </button>
                  </form>
                </div>
              )}

              {isOwner && slotsLeft === 0 && (
                <p className="text-center text-sm text-muted-foreground">Team is full (5/5 seats used).</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
