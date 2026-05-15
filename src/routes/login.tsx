import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/GlassCard";
import { GlassInput } from "@/components/GlassInput";
import { GlowButton } from "@/components/GlowButton";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — ProxiPay Mini" },
      { name: "description", content: "Sign in to your ProxiPay Mini account." },
      { property: "og:title", content: "Sign in — ProxiPay Mini" },
      { property: "og:description", content: "Sign in to your ProxiPay Mini account." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
      toast.error(err.message);
      return;
    }
    if (data.user) {
      localStorage.setItem("userId", data.user.id);
      localStorage.setItem("proxipay.sessionStart", String(Date.now()));
      toast.success("Welcome back!");
      navigate({ to: "/dashboard" });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-fade-up">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" />
        </div>
        <GlassCard elevated className="p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sign in to continue to your wallet
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <GlassInput
              type="email"
              name="email"
              label="Email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
            <GlassInput
              type="password"
              name="password"
              label="Password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive animate-fade-in">
                {error}
              </div>
            )}
            <GlowButton type="submit" loading={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </GlowButton>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Create one
            </Link>
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
