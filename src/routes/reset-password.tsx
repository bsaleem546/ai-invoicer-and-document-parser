import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Check if the user has an active session from the reset link
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setAuthorized(true);
      } else {
        toast.error("Invalid or expired password reset link.");
        navigate({ to: "/auth", replace: true });
      }
      setLoading(false);
    });

    // Also listen to auth changes in case of slower initialization
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setAuthorized(true);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success("Password updated successfully!");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background px-4 hero-glow bg-dot-grid">
        <div className="text-center">
          <p className="text-sm text-muted-foreground animate-pulse">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 hero-glow bg-dot-grid">
      {/* Bottom fade */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/0 via-background/5 to-background" />

      <div className="relative z-10 w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center gap-2.5 shrink-0 justify-center">
          <div className="flex h-7 w-7 items-center justify-center rounded-[5px] bg-primary">
            <FileText className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">DocFlow</span>
        </Link>

        <div className="rounded-xl border border-border/80 bg-surface/80 p-8 shadow-[0_32px_80px_oklch(0_0_0/30%)] backdrop-blur-md">
          <h1 className="font-display text-2xl font-bold">
            Choose new password
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set your new login credentials below.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">New Password</span>
              <PasswordInput value={password} onChange={setPassword} placeholder="••••••••" required minLength={6} />
            </label>

            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Confirm New Password</span>
              <PasswordInput value={confirmPassword} onChange={setConfirmPassword} placeholder="••••••••" required minLength={6} />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full mt-2"
            >
              {submitting ? "..." : "Update password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function PasswordInput({ value, onChange, ...rest }: {
  value: string; onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3.5 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all duration-150"
        {...rest}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
