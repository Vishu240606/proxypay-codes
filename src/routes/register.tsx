import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/GlassCard";
import { GlassInput } from "@/components/GlassInput";
import { GlowButton } from "@/components/GlowButton";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create account — ProxiPay Mini" },
      { name: "description", content: "Create a free ProxiPay Mini account and start sending money securely." },
      { property: "og:title", content: "Create account — ProxiPay Mini" },
      { property: "og:description", content: "Create a free ProxiPay Mini account and start sending money securely." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: RegisterPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
  email: z.string().trim().email("Invalid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ name, email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { name: parsed.data.name },
        emailRedirectTo: window.location.origin + "/dashboard",
      },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      toast.error(err.message);
      return;
    }
    if (data.user) {
      localStorage.setItem("userId", data.user.id);
      localStorage.setItem("proxipay.sessionStart", String(Date.now()));
      toast.success("Account created — welcome to ProxiPay!");
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
            <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Get $1,000 starter balance free
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <GlassInput
              name="name"
              label="Full name"
              placeholder="Jane Doe"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              required
            />
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
              placeholder="At least 6 characters"
              autoComplete="new-password"
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
              {loading ? "Creating account…" : "Create account"}
            </GlowButton>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
