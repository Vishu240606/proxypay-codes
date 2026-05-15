import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Mail,
  Wallet,
  Fingerprint,
  Clock,
  Copy,
  Check,
  KeyRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/GlassCard";
import { AppNav } from "@/components/AppNav";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile & security — ProxiPay Mini" },
      {
        name: "description",
        content:
          "Manage your ProxiPay account details, balance, and security status.",
      },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: ProfilePage,
});

function fmtMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function ProfilePage() {
  const [profile, setProfile] = useState<{
    id: string;
    email: string;
    name: string;
    balance: number;
    created_at: string;
  } | null>(null);
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const user = sess.session?.user;
      if (!user) return;
      setLastSignIn(user.last_sign_in_at ?? null);

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (data) {
        setProfile({
          id: data.id,
          email: data.email,
          name: data.name,
          balance: Number(data.balance),
          created_at: data.created_at,
        });
      }
    })();
  }, []);

  const handleCopy = async (txt: string) => {
    await navigator.clipboard.writeText(txt);
    setCopied(true);
    toast.success("User ID copied");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen">
      <AppNav userName={profile?.name} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 animate-fade-up">
          <h1 className="text-2xl font-bold sm:text-3xl">Profile & security</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Account information and current security posture.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Identity card */}
          <GlassCard
            elevated
            className="relative overflow-hidden p-6 sm:p-8 lg:col-span-2 animate-fade-up"
          >
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-25 blur-3xl"
              style={{ background: "var(--gradient-primary)" }}
            />
            <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-2xl font-bold text-primary ring-2 ring-primary/40">
                {(profile?.name?.[0] ?? "?").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-semibold">
                  {profile?.name ?? "—"}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  {profile?.email ?? "—"}
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verified
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Detail
                label="User ID"
                value={profile?.id ?? "—"}
                mono
                action={
                  profile && (
                    <button
                      onClick={() => handleCopy(profile.id)}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                      aria-label="Copy user ID"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )
                }
              />
              <Detail
                label="Member since"
                value={
                  profile
                    ? new Date(profile.created_at).toLocaleDateString()
                    : "—"
                }
              />
              <Detail
                label="Last sign-in"
                value={lastSignIn ? new Date(lastSignIn).toLocaleString() : "—"}
              />
              <Detail
                label="Account status"
                value="Active"
                valueClass="text-emerald-400"
              />
            </div>
          </GlassCard>

          {/* Balance */}
          <GlassCard
            className="p-6 sm:p-8 animate-fade-up"
            style={{ animationDelay: "60ms" }}
          >
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" /> Current balance
            </div>
            <div className="mt-3 text-3xl font-bold gradient-text sm:text-4xl">
              {profile ? fmtMoney(profile.balance) : "—"}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Available to send instantly via verification codes.
            </p>
          </GlassCard>
        </div>

        {/* Security */}
        <GlassCard
          className="mt-6 p-6 sm:p-8 animate-fade-up"
          style={{ animationDelay: "120ms" }}
        >
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Security overview</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <SecurityItem
              icon={KeyRound}
              title="Password"
              status="Strong"
              detail="Encrypted at rest"
              ok
            />
            <SecurityItem
              icon={Fingerprint}
              title="Biometric verification"
              status="Enabled"
              detail="Required for every transfer"
              ok
            />
            <SecurityItem
              icon={Clock}
              title="One-time codes"
              status="2-minute TTL"
              detail="Codes auto-expire"
              ok
            />
          </div>
        </GlassCard>
      </main>
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
  action,
  valueClass,
}: {
  label: string;
  value: string;
  mono?: boolean;
  action?: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-glass-border bg-black/20 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span
          className={`truncate text-sm ${mono ? "font-mono text-xs" : ""} ${valueClass ?? "text-foreground"}`}
        >
          {value}
        </span>
        {action}
      </div>
    </div>
  );
}

function SecurityItem({
  icon: Icon,
  title,
  status,
  detail,
  ok,
}: {
  icon: typeof ShieldCheck;
  title: string;
  status: string;
  detail: string;
  ok: boolean;
}) {
  return (
    <div className="rounded-2xl border border-glass-border bg-black/20 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">{title}</div>
            <div className="text-[10px] text-muted-foreground">{detail}</div>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            ok
              ? "bg-emerald-400/10 text-emerald-400"
              : "bg-amber-400/10 text-amber-400"
          }`}
        >
          {status}
        </span>
      </div>
    </div>
  );
}
