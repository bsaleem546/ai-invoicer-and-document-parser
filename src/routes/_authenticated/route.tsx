import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, LayoutDashboard, Settings, LogOut, Sun, Moon } from "lucide-react";
import { useAppTheme } from "@/lib/theme-context";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const { theme, toggle } = useAppTheme();

  const initials = (profile?.full_name || user.email || "U")
    .split(" ").map((s: string) => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="flex h-14 w-full items-center gap-6 px-6">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-sm bg-primary" />
            <span className="font-display text-lg font-bold">DocFlow</span>
          </Link>
          <nav className="hidden gap-1 md:flex">
            <NavLink to="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />}>Dashboard</NavLink>
            <NavLink to="/documents" icon={<FileText className="h-4 w-4" />}>Documents</NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden rounded-sm border border-border px-2 py-0.5 font-mono text-xs uppercase text-muted-foreground sm:inline">
              {profile?.plan ?? "free"}
            </span>
            <Link
              to="/settings"
              className="rounded-md p-2 text-muted-foreground hover:bg-surface hover:text-foreground"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <button
              id="theme-toggle-dashboard"
              onClick={toggle}
              aria-label="Toggle theme"
              className="theme-toggle"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-elevated text-xs font-medium">
              {initials}
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-md p-2 text-muted-foreground hover:bg-surface hover:text-foreground"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="w-full px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

function NavLink({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-surface hover:text-foreground"
      activeProps={{ className: "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm bg-surface text-foreground" }}
    >
      {icon} {children}
    </Link>
  );
}
