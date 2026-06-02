import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Search, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/GlassCard";
import { GlassInput } from "@/components/GlassInput";
import { AppNav } from "@/components/AppNav";

interface Transaction {
  id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  code: string;
  created_at: string;
  payment_type?: string;
  sender_handle?: string;
  receiver_handle?: string;
}


export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Transaction history — ProxiPay Mini" },
      {
        name: "description",
        content: "Review every payment you have sent or received.",
      },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: HistoryPage,
});

function fmtMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

type FilterMode = "all" | "sent" | "received";

function HistoryPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | undefined>();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return;
      const uid = sess.session.user.id;
      setUserId(uid);

      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", uid)
        .single();
      if (profile) setUserName(profile.name);

      const { data: rows } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (rows) {
        const ids = Array.from(
          new Set(rows.flatMap((r) => [r.sender_id, r.receiver_id])),
        );
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, user_id")
          .in("id", ids);
        const map = new Map(profiles?.map((p) => [p.id, p.user_id]) ?? []);
        setTxs(
          rows.map((r) => ({
            ...r,
            amount: Number(r.amount),
            sender_handle: map.get(r.sender_id),
            receiver_handle: map.get(r.receiver_id),
          })) as Transaction[],
        );
      }

      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return txs.filter((t) => {
      const isOut = t.sender_id === userId;
      if (filter === "sent" && !isOut) return false;
      if (filter === "received" && isOut) return false;
      if (q) {
        const needle = q.toLowerCase();
        const counter = (isOut ? t.receiver_email : t.sender_email) ?? "";
        if (
          !counter.toLowerCase().includes(needle) &&
          !t.code.toLowerCase().includes(needle)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [txs, filter, q, userId]);

  const totals = useMemo(() => {
    let sent = 0,
      received = 0;
    for (const t of txs) {
      if (t.sender_id === userId) sent += t.amount;
      else if (t.receiver_id === userId) received += t.amount;
    }
    return { sent, received, count: txs.length };
  }, [txs, userId]);

  return (
    <div className="min-h-screen">
      <AppNav userName={userName} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 animate-fade-up">
          <h1 className="text-2xl font-bold sm:text-3xl">Transaction history</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every transfer in and out of your wallet.
          </p>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <StatCard label="Total sent" value={fmtMoney(totals.sent)} tone="out" />
          <StatCard
            label="Total received"
            value={fmtMoney(totals.received)}
            tone="in"
          />
          <StatCard
            label="Transactions"
            value={String(totals.count)}
            tone="neutral"
          />
        </div>

        <GlassCard className="animate-fade-up p-4 sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-xs flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <GlassInput
                name="search"
                placeholder="Search by email or code…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="inline-flex items-center gap-1 rounded-xl border border-glass-border bg-glass p-1 text-xs">
              <Filter className="ml-2 h-3 w-3 text-muted-foreground" />
              {(["all", "sent", "received"] as FilterMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setFilter(m)}
                  className={`rounded-lg px-3 py-1.5 capitalize transition-colors ${
                    filter === m
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading transactions…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No transactions match your filters.
            </div>
          ) : (
            <ul className="divide-y divide-glass-border">
              {filtered.map((t) => {
                const isOut = t.sender_id === userId;
                const counter = isOut ? t.receiver_email : t.sender_email;
                return (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 py-3 sm:py-4"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                          isOut
                            ? "bg-destructive/10 text-destructive"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {isOut ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <ArrowDownLeft className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          {isOut ? "Sent to" : "Received from"}
                          <span className="truncate text-muted-foreground">
                            {counter ?? "unknown"}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                          <span className="font-mono">{t.code}</span>
                          <span>·</span>
                          <span>
                            {new Date(t.created_at).toLocaleString()}
                          </span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Completed
                          </span>
                          {t.payment_type === "qr" && (
                            <span className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                              QR Payment
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`flex-shrink-0 font-mono text-sm font-bold sm:text-base ${
                        isOut ? "text-destructive" : "text-primary"
                      }`}
                    >
                      {isOut ? "-" : "+"}
                      {fmtMoney(t.amount)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassCard>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "in" | "out" | "neutral";
}) {
  const color =
    tone === "in"
      ? "text-primary"
      : tone === "out"
        ? "text-destructive"
        : "text-foreground";
  return (
    <GlassCard className="p-4 sm:p-5">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
    </GlassCard>
  );
}
