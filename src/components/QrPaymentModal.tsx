import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { X, ShieldCheck, RefreshCw, Loader2, QrCode, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface QrSession {
  token: string;
  expiresAt: string;
  ttlSeconds: number;
}

interface Props {
  open: boolean;
  session: QrSession | null;
  generating: boolean;
  onGenerate: () => void;
  onClose: () => void;
}

export function QrPaymentModal({ open, session, generating, onGenerate, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [copied, setCopied] = useState(false);

  // Auto-generate on first open
  useEffect(() => {
    if (open && !session && !generating) onGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Countdown
  useEffect(() => {
    if (!session) return;
    const tick = () => {
      const left = Math.max(
        0,
        Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(left);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session]);

  // Render QR
  useEffect(() => {
    if (!session || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, session.token, {
      width: 256,
      margin: 1,
      color: { dark: "#0a0a0a", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).catch(() => {
      /* noop */
    });
  }, [session]);

  if (!open) return null;

  const expired = !!session && secondsLeft <= 0;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const timerColor =
    secondsLeft <= 10
      ? "text-destructive"
      : secondsLeft <= 30
        ? "text-amber-400"
        : "text-primary";

  const ringColor =
    secondsLeft <= 10
      ? "ring-destructive/60"
      : secondsLeft <= 30
        ? "ring-amber-400/60"
        : "ring-primary/60";

  const handleCopy = async () => {
    if (!session) return;
    await navigator.clipboard.writeText(session.token);
    setCopied(true);
    toast.success("QR token copied — paste it in another browser to test");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-background/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl border border-glass-border bg-glass p-8 shadow-2xl backdrop-blur-2xl animate-scale-in">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/40">
            <QrCode className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">Secure QR Payment</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Show this code to the sender to receive funds
          </p>
        </div>

        {/* QR display */}
        <div className="relative mx-auto w-fit">
          <div
            className={`relative rounded-3xl p-1 transition-all ${
              session && !expired
                ? "animate-glow-pulse"
                : ""
            }`}
            style={{
              background:
                session && !expired
                  ? "linear-gradient(135deg, var(--primary), color-mix(in oklab, var(--primary) 40%, transparent))"
                  : "rgba(255,255,255,0.08)",
            }}
          >
            <div className={`rounded-[20px] bg-white p-3 ring-2 ${ringColor} transition-all`}>
              {generating || !session ? (
                <div className="flex h-[256px] w-[256px] items-center justify-center bg-white">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
              ) : (
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    className={`block transition-all ${expired ? "opacity-20 blur-sm" : ""}`}
                  />
                  {expired && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="rounded-lg bg-destructive/90 px-3 py-1.5 text-sm font-bold text-white">
                        QR Expired
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Timer */}
        <div className="mt-5 flex items-center justify-between rounded-2xl border border-glass-border bg-black/30 px-4 py-3">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Expires in
          </span>
          <span className={`font-mono text-2xl font-bold tabular-nums ${timerColor}`}>
            {mm}:{ss}
          </span>
        </div>

        {/* Security badge */}
        <div className="mt-3 flex items-center justify-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-medium text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          Encrypted • One-Time Use • Auto Expires
        </div>

        {/* Actions */}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            onClick={handleCopy}
            disabled={!session || expired}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-glass-border bg-glass px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-white/10 disabled:opacity-40"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy token"}
          </button>
          {expired ? (
            <button
              onClick={onGenerate}
              disabled={generating}
              className="btn-glow inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
            >
              <RefreshCw className="h-4 w-4" />
              Generate New QR
            </button>
          ) : (
            <button
              onClick={onClose}
              className="btn-glow inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
