import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Wallet, KeyRound, Send, Copy, Check, Clock, QrCode, ScanLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/GlassCard";
import { GlassInput } from "@/components/GlassInput";
import { GlowButton } from "@/components/GlowButton";
import { AppNav } from "@/components/AppNav";
import {
  PaymentFlowModal,
  type PaymentStep,
  type PaymentSuccessData,
} from "@/components/PaymentFlowModal";
import { QrPaymentModal } from "@/components/QrPaymentModal";
import {
  QrScannerModal,
  type ScannedSession,
  type ScannerPhase,
} from "@/components/QrScannerModal";
import {
  requestPaymentCode,
  sendMoney,
  validatePaymentCode,
  lookupReceiver,
} from "@/server/payments.functions";
import {
  generateQrSession,
  scanQrSession,
  sendMoneyByQr,
} from "@/server/qr.functions";
import { useAuthedFn } from "@/hooks/useAuthedFn";
import { pushNotification } from "@/lib/notifications";

interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  balance: number;
}

interface ReceiverInfo {
  id: string;
  name: string;
  userId: string;
}

interface Transaction {
  id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  code: string;
  created_at: string;
}

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ProxiPay Mini" },
      { name: "description", content: "Your ProxiPay wallet — request codes and send money securely." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: DashboardPage,
});

function fmtMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function DashboardPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const requestFn = useAuthedFn(useServerFn(requestPaymentCode));
  const sendFn = useAuthedFn(useServerFn(sendMoney));
  const validateFn = useAuthedFn(useServerFn(validatePaymentCode));
  const generateQrFn = useAuthedFn(useServerFn(generateQrSession));
  const scanQrFn = useAuthedFn(useServerFn(scanQrSession));
  const sendQrFn = useAuthedFn(useServerFn(sendMoneyByQr));

  // Active code state
  const [activeCode, setActiveCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [reqAmount, setReqAmount] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Send form
  const [sendEmail, setSendEmail] = useState("");
  const [sendAmt, setSendAmt] = useState("");
  const [sendCode, setSendCode] = useState("");

  // Payment flow
  const [flowOpen, setFlowOpen] = useState(false);
  const [flowStep, setFlowStep] = useState<PaymentStep>("validating");
  const [flowError, setFlowError] = useState<string | undefined>();
  const [successData, setSuccessData] = useState<PaymentSuccessData | undefined>();
  const sending = flowOpen && flowStep !== "success" && flowStep !== "validation-error" && flowStep !== "error";

  // QR payment (receiver) state
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrSession, setQrSession] = useState<{ token: string; expiresAt: string; ttlSeconds: number } | null>(null);
  const [qrGenerating, setQrGenerating] = useState(false);

  // QR scanner (sender) state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerPhase, setScannerPhase] = useState<ScannerPhase>("scanning");
  const [scannedSession, setScannedSession] = useState<ScannedSession | null>(null);
  const [scannerError, setScannerError] = useState<string | undefined>();
  const [scanning, setScanning] = useState(false);
  const [qrPayAmount, setQrPayAmount] = useState("");
  // Track active payment source so completePayment knows which backend to call
  const [paymentSource, setPaymentSource] = useState<"code" | "qr">("code");


  const loadProfile = async () => {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) {
      navigate({ to: "/login" });
      return;
    }
    const userId = sess.session.user.id;
    const [{ data: p }, { data: t }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);
    if (p) {
      setProfile({
        id: p.id,
        name: p.name,
        email: p.email,
        balance: Number(p.balance),
      });
    }
    if (t) {
      setTxs(
        t.map((row) => ({
          ...row,
          amount: Number(row.amount),
        })) as Transaction[],
      );
    }
    setLoadingProfile(false);
  };

  useEffect(() => {
    loadProfile();
  }, []);

  // Countdown
  useEffect(() => {
    if (!activeCode) return;
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(activeCode.expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) setActiveCode(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeCode]);

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const amt = reqAmount ? Number(reqAmount) : null;
      if (amt !== null && (isNaN(amt) || amt <= 0)) {
        toast.error("Amount must be greater than 0");
        setGenerating(false);
        return;
      }
      const result = await requestFn({ data: { amount: amt ?? undefined } });
      setActiveCode({ code: result.code, expiresAt: result.expiresAt });
      setReqAmount("");
      toast.success("Code generated — share it with the sender");
      pushNotification({
        kind: "session",
        title: "New verification code issued",
        message: `Code ${result.code} is active for 2 minutes${
          amt ? ` for ${amt.toFixed(2)} USD` : ""
        }.`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate code");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!activeCode) return;
    await navigator.clipboard.writeText(activeCode.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const startPaymentFlow = async (e: FormEvent) => {
    e.preventDefault();
    const amt = Number(sendAmt);
    if (!sendEmail || !sendCode || isNaN(amt) || amt <= 0) {
      toast.error("Fill in all fields with a valid amount");
      return;
    }

    setPaymentSource("code");
    setFlowError(undefined);
    setSuccessData(undefined);
    setFlowStep("validating");
    setFlowOpen(true);

    // Step 1: validate code
    try {
      await validateFn({
        data: {
          receiverEmail: sendEmail.trim().toLowerCase(),
          amount: amt,
          code: sendCode.trim().toUpperCase(),
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid verification code";
      setFlowError(msg);
      setFlowStep("validation-error");
      pushNotification({
        kind: "security",
        title: "Invalid session attempt blocked",
        message: `${msg}. Receiver: ${sendEmail.trim().toLowerCase()}`,
      });
      return;
    }

    // Step 2: face auth
    setFlowStep("face-scanning");
  };

  /* ---------------- QR receiver flow ---------------- */
  const openQrModal = () => {
    setQrSession(null);
    setQrModalOpen(true);
  };

  const handleGenerateQr = async () => {
    setQrGenerating(true);
    try {
      const result = await generateQrFn({ data: undefined as any });
      setQrSession({
        token: result.token,
        expiresAt: result.expiresAt,
        ttlSeconds: result.ttlSeconds,
      });
      pushNotification({
        kind: "session",
        title: "Secure QR generated",
        message: "QR session active for 90 seconds.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate QR");
      setQrModalOpen(false);
    } finally {
      setQrGenerating(false);
    }
  };

  /* ---------------- QR scanner (sender) flow ---------------- */
  const openScanner = () => {
    setScannedSession(null);
    setScannerError(undefined);
    setScannerPhase("scanning");
    setQrPayAmount("");
    setScannerOpen(true);
  };

  const handleScanSubmit = async (token: string) => {
    setScanning(true);
    setScannerError(undefined);
    try {
      const result = await scanQrFn({ data: { token } });
      setScannedSession({ ...result, token });
      setScannerPhase("scanned");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid QR code";
      setScannerError(msg);
      pushNotification({
        kind: "security",
        title: "Invalid QR scan blocked",
        message: msg,
      });
    } finally {
      setScanning(false);
    }
  };

  const handleRescan = () => {
    setScannedSession(null);
    setScannerPhase("scanning");
    setScannerError(undefined);
    setQrPayAmount("");
  };

  const confirmQrPayment = () => {
    if (!scannedSession) return;
    const amt = Number(qrPayAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    // Move into the unified payment flow modal
    setPaymentSource("qr");
    setFlowError(undefined);
    setSuccessData(undefined);
    setScannerOpen(false);
    setFlowStep("face-scanning");
    setFlowOpen(true);
  };


  // Simulated face auth — randomly fails ~15% of the time for realism
  const handleFaceVerified = () => {
    if (Math.random() < 0.15) {
      setFlowStep("face-failed");
      pushNotification({
        kind: "security",
        title: "Biometric verification failed",
        message: "Face authentication did not match. Payment not processed.",
      });
      return;
    }
    void completePayment();
  };

  const handleFaceRetry = () => {
    setFlowStep("face-scanning");
  };

  const completePayment = async () => {
    setFlowStep("processing");
    try {
      let result: { amount: number; receiverEmail: string };
      if (paymentSource === "qr") {
        if (!scannedSession) throw new Error("QR session lost");
        const amt = Number(qrPayAmount);
        result = await sendQrFn({
          data: { token: scannedSession.token, amount: amt },
        });
      } else {
        const amt = Number(sendAmt);
        result = await sendFn({
          data: {
            receiverEmail: sendEmail.trim().toLowerCase(),
            amount: amt,
            code: sendCode.trim().toUpperCase(),
          },
        });
      }
      const txId =
        "TX-" +
        Math.random().toString(36).slice(2, 8).toUpperCase() +
        "-" +
        Date.now().toString(36).toUpperCase();
      setSuccessData({
        amount: result.amount,
        receiverEmail: result.receiverEmail,
        transactionId: txId,
        timestamp: new Date().toISOString(),
      });
      setFlowStep("success");
      pushNotification({
        kind: "payment",
        title: paymentSource === "qr" ? "QR payment sent" : "Payment sent",
        message: `${result.amount.toFixed(2)} USD sent to ${result.receiverEmail}.`,
      });
      await loadProfile();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment failed";
      setFlowError(msg);
      setFlowStep("error");
      pushNotification({
        kind: "security",
        title: "Payment blocked",
        message: msg,
      });
    }
  };

  const closeFlow = () => {
    if (flowStep === "processing") return;
    setFlowOpen(false);
  };

  const finishFlow = () => {
    setFlowOpen(false);
    if (paymentSource === "qr") {
      setScannedSession(null);
      setQrPayAmount("");
      setScannerPhase("scanning");
    } else {
      setSendEmail("");
      setSendAmt("");
      setSendCode("");
    }
  };


  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="min-h-screen">
      <AppNav userName={profile?.name} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Balance card */}
        <GlassCard
          elevated
          className="relative mb-8 overflow-hidden p-8 animate-fade-up sm:p-10"
        >
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-30 blur-3xl"
            style={{ background: "var(--gradient-primary)" }}
          />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" /> Available balance
            </div>
            <div className="mt-3 text-5xl font-bold tracking-tight sm:text-6xl">
              {loadingProfile ? (
                <span className="text-muted-foreground">···</span>
              ) : (
                <span className="gradient-text">{fmtMoney(profile?.balance ?? 0)}</span>
              )}
            </div>
            {profile && (
              <p className="mt-2 text-sm text-muted-foreground">{profile.email}</p>
            )}
          </div>
        </GlassCard>

        {/* QR Payment quick actions */}
        <GlassCard
          className="mb-6 animate-fade-up p-5 sm:p-6"
          style={{ animationDelay: "30ms" }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold">Temporary QR Payment</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Encrypted one-time QR sessions · auto-expire in 90 seconds
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
              <button
                onClick={openQrModal}
                className="btn-glow inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
              >
                <QrCode className="h-4 w-4" />
                Generate Secure QR
              </button>
              <button
                onClick={openScanner}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-glass-border bg-glass px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-white/10"
              >
                <ScanLine className="h-4 w-4" />
                Scan QR
              </button>
            </div>
          </div>
        </GlassCard>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Request payment */}
          <GlassCard className="animate-fade-up p-6 sm:p-7" style={{ animationDelay: "60ms" }}>
            <div className="mb-5 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">Request payment code</h2>
            </div>
            <form onSubmit={handleGenerate} className="space-y-4">
              <GlassInput
                type="number"
                step="0.01"
                min="0"
                name="amount"
                label="Amount (optional)"
                placeholder="Leave empty for any amount"
                value={reqAmount}
                onChange={(e) => setReqAmount(e.target.value)}
                disabled={generating}
              />
              <GlowButton type="submit" loading={generating}>
                {generating ? "Generating…" : "Generate code"}
              </GlowButton>
            </form>

            {activeCode && (
              <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-5 animate-fade-in">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Your one-time code
                </div>
                <div className="mt-2 flex items-center justify-between gap-4">
                  <div className="font-mono text-3xl font-bold tracking-[0.2em] text-foreground sm:text-4xl">
                    {activeCode.code}
                  </div>
                  <button
                    onClick={handleCopy}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-glass-border bg-glass transition-colors hover:bg-white/10"
                    aria-label="Copy code"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Expires in
                  </span>
                  <span
                    className={`font-mono font-semibold ${secondsLeft < 30 ? "text-destructive" : "text-primary"}`}
                  >
                    {mm}:{ss}
                  </span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${(secondsLeft / 120) * 100}%`,
                      background: "var(--gradient-primary)",
                    }}
                  />
                </div>
              </div>
            )}
          </GlassCard>

          {/* Send money */}
          <GlassCard className="animate-fade-up p-6 sm:p-7" style={{ animationDelay: "120ms" }}>
            <div className="mb-5 flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">Send money</h2>
            </div>
            <form onSubmit={startPaymentFlow} className="space-y-4">
              <GlassInput
                type="email"
                name="receiver"
                label="Receiver email"
                placeholder="receiver@example.com"
                value={sendEmail}
                onChange={(e) => setSendEmail(e.target.value)}
                disabled={sending}
                required
              />
              <GlassInput
                type="number"
                step="0.01"
                min="0.01"
                name="amount"
                label="Amount"
                placeholder="0.00"
                value={sendAmt}
                onChange={(e) => setSendAmt(e.target.value)}
                disabled={sending}
                required
              />
              <GlassInput
                name="code"
                label="Verification code"
                placeholder="PX••••••"
                value={sendCode}
                onChange={(e) => setSendCode(e.target.value.toUpperCase())}
                disabled={sending}
                required
                className="font-mono tracking-widest"
              />
              <GlowButton type="submit" loading={sending}>
                {sending ? "Processing…" : "Send money"}
              </GlowButton>
            </form>
          </GlassCard>
        </div>

        {/* Transactions */}
        <GlassCard className="mt-6 animate-fade-up p-6 sm:p-7" style={{ animationDelay: "180ms" }}>
          <h2 className="mb-4 text-base font-semibold">Recent activity</h2>
          {txs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No transactions yet. Send or receive money to see activity here.
            </p>
          ) : (
            <ul className="divide-y divide-glass-border">
              {txs.map((tx) => {
                const isOutgoing = tx.sender_id === profile?.id;
                return (
                  <li key={tx.id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-sm font-medium">
                        {isOutgoing ? "Sent" : "Received"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Code {tx.code} · {new Date(tx.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div
                      className={`font-mono text-sm font-semibold ${isOutgoing ? "text-destructive" : "text-primary"}`}
                    >
                      {isOutgoing ? "-" : "+"}
                      {fmtMoney(tx.amount)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassCard>
      </main>

      <PaymentFlowModal
        open={flowOpen}
        step={flowStep}
        errorMessage={flowError}
        successData={successData}
        onCancel={closeFlow}
        onFaceVerified={handleFaceVerified}
        onFaceRetry={handleFaceRetry}
        onDone={finishFlow}
      />

      <QrPaymentModal
        open={qrModalOpen}
        session={qrSession}
        generating={qrGenerating}
        onGenerate={handleGenerateQr}
        onClose={() => setQrModalOpen(false)}
      />

      <QrScannerModal
        open={scannerOpen}
        phase={scannerPhase}
        scanned={scannedSession}
        errorMessage={scannerError}
        scanning={scanning}
        amount={qrPayAmount}
        onAmountChange={setQrPayAmount}
        onClose={() => setScannerOpen(false)}
        onScanSubmit={handleScanSubmit}
        onConfirm={confirmQrPayment}
        onRescan={handleRescan}
      />
    </div>
  );
}
