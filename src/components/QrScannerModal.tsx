import { useEffect, useState } from "react";
import {
  X,
  ScanLine,
  Loader2,
  AlertTriangle,
  Send,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { GlassInput } from "@/components/GlassInput";

export interface ScannedSession {
  sessionId: string;
  receiverId: string;
  receiverEmail: string;
  receiverName: string;
  token: string;
  expiresAt: string;
}

export type ScannerPhase = "scanning" | "scanned" | "error";

interface Props {
  open: boolean;
  phase: ScannerPhase;
  scanned: ScannedSession | null;
  errorMessage?: string;
  scanning: boolean;
  amount: string;
  onAmountChange: (v: string) => void;
  onClose: () => void;
  onScanSubmit: (token: string) => void;
  onConfirm: () => void;
  onRescan: () => void;
}

export function QrScannerModal({
  open,
  phase,
  scanned,
  errorMessage,
  scanning,
  amount,
  onAmountChange,
  onClose,
  onScanSubmit,
  onConfirm,
  onRescan,
}: Props) {
  const [manualToken, setManualToken] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!open) setManualToken("");
  }, [open]);

  useEffect(() => {
    if (!scanned) return;
    const tick = () => {
      const left = Math.max(
        0,
        Math.floor((new Date(scanned.expiresAt).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(left);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [scanned]);

  if (!open) return null;

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

        {phase === "scanning" && (
          <div className="animate-fade-in">
            <div className="mb-5 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/40">
                <ScanLine className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Scan QR to Pay</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Align the QR within the frame or paste the token below
              </p>
            </div>

            {/* Scanner viewport */}
            <div className="relative mx-auto aspect-square w-64 overflow-hidden rounded-2xl border border-glass-border bg-black/60">
              <div
                className="absolute inset-0 opacity-50"
                style={{
                  background:
                    "radial-gradient(circle at 50% 50%, color-mix(in oklab, var(--primary) 25%, transparent), transparent 70%)",
                }}
              />
              {scanning ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <ScanLine className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 text-primary/30" />
                  <div className="pointer-events-none absolute inset-x-6 h-0.5 animate-scan-line bg-primary shadow-[0_0_16px_4px_color-mix(in_oklab,var(--primary)_60%,transparent)]" />
                </>
              )}
              {/* Corner brackets */}
              <span className="absolute left-3 top-3 h-6 w-6 rounded-tl-lg border-l-2 border-t-2 border-primary" />
              <span className="absolute right-3 top-3 h-6 w-6 rounded-tr-lg border-r-2 border-t-2 border-primary" />
              <span className="absolute bottom-3 left-3 h-6 w-6 rounded-bl-lg border-b-2 border-l-2 border-primary" />
              <span className="absolute bottom-3 right-3 h-6 w-6 rounded-br-lg border-b-2 border-r-2 border-primary" />
            </div>

            <form
              className="mt-6 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (manualToken.trim()) onScanSubmit(manualToken.trim());
              }}
            >
              <GlassInput
                label="QR token"
                placeholder="PXQR.xxxx.xxxx"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                disabled={scanning}
                className="font-mono text-xs"
              />
              {errorMessage && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={scanning || !manualToken.trim()}
                className="btn-glow inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
              >
                {scanning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Validating…
                  </>
                ) : (
                  <>
                    <ScanLine className="h-4 w-4" />
                    Validate QR
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {phase === "scanned" && scanned && (
          <div className="animate-fade-in">
            <div className="mb-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 ring-2 ring-primary/60 animate-scale-in">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">QR Verified</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Enter the amount to send to this recipient
              </p>
            </div>

            <div className="rounded-2xl border border-glass-border bg-black/30 p-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">Receiver</span>
                  <span className="truncate font-medium">{scanned.receiverName}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">Email</span>
                  <span className="truncate text-xs">{scanned.receiverEmail}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">Session expires</span>
                  <span className="font-mono text-xs text-primary">
                    {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:
                    {String(secondsLeft % 60).padStart(2, "0")}
                  </span>
                </div>
              </div>
            </div>

            <form
              className="mt-5 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                onConfirm();
              }}
            >
              <GlassInput
                type="number"
                step="0.01"
                min="0.01"
                label="Amount (USD)"
                placeholder="0.00"
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                required
                autoFocus
              />
              <div className="flex items-center justify-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-medium text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                Biometric verification required
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onRescan}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-glass-border bg-glass px-4 py-3 text-sm font-medium transition-colors hover:bg-white/10"
                >
                  Rescan
                </button>
                <button
                  type="submit"
                  disabled={!amount || Number(amount) <= 0 || secondsLeft <= 0}
                  className="btn-glow inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  Continue
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
