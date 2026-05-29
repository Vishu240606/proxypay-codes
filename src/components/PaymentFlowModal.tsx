import { useEffect, useState, useCallback } from "react";
import {
  ScanFace,
  Check,
  X,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Receipt,
  Copy,
  Fingerprint,
  Download,
} from "lucide-react";
import { toast } from "sonner";

export type PaymentStep =
  | "validating"
  | "validation-error"
  | "face-scanning"
  | "face-failed"
  | "processing"
  | "success"
  | "error";

export interface PaymentSuccessData {
  amount: number;
  receiverHandle: string;
  transactionId: string;
  timestamp: string;
}

interface Props {
  open: boolean;
  step: PaymentStep;
  errorMessage?: string;
  successData?: PaymentSuccessData;
  onCancel: () => void;
  onFaceVerified: () => void;
  onFaceRetry: () => void;
  onDone: () => void;
}

function fmtMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function PaymentFlowModal({
  open,
  step,
  errorMessage,
  successData,
  onCancel,
  onFaceVerified,
  onFaceRetry,
  onDone,
}: Props) {
  if (!open) return null;

  // Block backdrop close during destructive steps
  const canDismiss =
    step === "validation-error" || step === "face-failed" || step === "error";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-md"
        onClick={canDismiss ? onCancel : undefined}
      />

      <div
        key={step}
        className="relative w-full max-w-md rounded-3xl border border-glass-border bg-glass p-8 shadow-2xl backdrop-blur-2xl animate-scale-in"
      >
        {step === "validating" && <ValidatingView onCancel={onCancel} />}
        {step === "validation-error" && (
          <ErrorView
            title="Verification failed"
            message={errorMessage ?? "Invalid verification code"}
            onClose={onCancel}
            closeLabel="Close"
          />
        )}
        {step === "face-scanning" && (
          <FaceScanView onCancel={onCancel} onComplete={onFaceVerified} />
        )}
        {step === "face-failed" && (
          <ErrorView
            title="Face verification failed"
            message="We couldn't verify your identity. Please try again."
            onClose={onCancel}
            closeLabel="Cancel"
            onRetry={onFaceRetry}
            variant="warning"
          />
        )}
        {step === "processing" && <ProcessingView />}
        {step === "success" && successData && (
          <SuccessView data={successData} onDone={onDone} />
        )}
        {step === "error" && (
          <ErrorView
            title="Payment failed"
            message={errorMessage ?? "Something went wrong"}
            onClose={onCancel}
            closeLabel="Close"
          />
        )}
      </div>
    </div>
  );
}

/* -------------------- Steps -------------------- */

function StepHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      {subtitle && (
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}

function CenterIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border border-glass-border bg-black/30">
      {children}
    </div>
  );
}

function ValidatingView({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="animate-fade-in">
      <StepHeader
        title="Validating verification code"
        subtitle="Checking with the receiver's account…"
      />
      <CenterIcon>
        <ShieldCheck className="h-14 w-14 text-primary animate-pulse" />
      </CenterIcon>
      <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Validating…
      </div>
      <CancelButton onClick={onCancel} />
    </div>
  );
}

function FaceScanView({
  onCancel,
  onComplete,
}: {
  onCancel: () => void;
  onComplete: () => void;
}) {
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setVerified(true), 2400);
    const t2 = setTimeout(() => onComplete(), 3300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onComplete]);

  return (
    <div className="animate-fade-in">
      <StepHeader
        title={verified ? "Verified" : "Face Authentication"}
        subtitle={
          verified
            ? "Identity confirmed — completing your payment"
            : "Look at the camera to confirm your payment"
        }
      />

      <div className="relative mx-auto aspect-square w-56 overflow-hidden rounded-full border border-glass-border bg-black/40">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(circle at 50% 40%, color-mix(in oklab, var(--primary) 30%, transparent), transparent 60%)",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          {verified ? (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 ring-2 ring-primary animate-scale-in">
              <Check className="h-10 w-10 text-primary" strokeWidth={3} />
            </div>
          ) : (
            <ScanFace className="h-24 w-24 text-primary/80 animate-pulse" />
          )}
        </div>
        {!verified && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 animate-scan bg-gradient-to-b from-primary/80 to-transparent shadow-[0_0_20px_4px_color-mix(in_oklab,var(--primary)_50%,transparent)]" />
        )}
        <CornerBrackets active={!verified} />
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 text-sm">
        {verified ? (
          <>
            <Check className="h-4 w-4 text-primary" />
            <span className="font-medium text-primary">
              Face Verified Successfully
            </span>
          </>
        ) : (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-muted-foreground">Scanning face…</span>
          </>
        )}
      </div>

      {!verified && <CancelButton onClick={onCancel} />}
    </div>
  );
}

function ProcessingView() {
  return (
    <div className="animate-fade-in">
      <StepHeader
        title="Processing transaction"
        subtitle="Securely transferring funds…"
      />
      <CenterIcon>
        <Loader2 className="h-14 w-14 text-primary animate-spin" />
      </CenterIcon>
      <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <span>Please don't close this window</span>
      </div>
    </div>
  );
}

function SuccessView({
  data,
  onDone,
}: {
  data: PaymentSuccessData;
  onDone: () => void;
}) {
  const copyId = useCallback(() => {
    navigator.clipboard.writeText(data.transactionId);
    toast.success("Transaction ID copied");
  }, [data.transactionId]);

  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 ring-2 ring-primary animate-scale-in">
          <Check className="h-10 w-10 text-primary" strokeWidth={3} />
        </div>
        <h3 className="mt-4 text-xl font-semibold">Payment Successful</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Your transfer has been completed securely
        </p>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-400">
          <Fingerprint className="h-3 w-3" />
          Biometric verified
        </span>
      </div>

      <div className="rounded-2xl border border-glass-border bg-black/20 p-5">
        <div className="text-center">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Amount sent
          </div>
          <div className="mt-1 text-3xl font-bold gradient-text">
            {fmtMoney(data.amount)}
          </div>
        </div>

        <div className="mt-5 space-y-3 text-sm">
          <Row label="To" value={`@${data.receiverHandle}`} mono />
          <Row
            label="Transaction ID"
            value={data.transactionId}
            mono
            action={
              <button
                onClick={copyId}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                aria-label="Copy transaction ID"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            }
          />
          <Row
            label="Timestamp"
            value={new Date(data.timestamp).toLocaleString()}
          />
          <Row label="Status" value="Completed" valueClass="text-emerald-400" />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2">
        <button
          onClick={() => downloadReceipt(data)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-glass-border bg-glass px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-white/10"
        >
          <Download className="h-4 w-4" />
          Receipt
        </button>
        <button
          onClick={onDone}
          className="btn-glow inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold"
        >
          <Receipt className="h-4 w-4" />
          Done
        </button>
      </div>
    </div>
  );
}

function downloadReceipt(data: PaymentSuccessData) {
  const lines = [
    "ProxiPay Mini — Payment Receipt",
    "================================",
    `Transaction ID : ${data.transactionId}`,
    `Date           : ${new Date(data.timestamp).toLocaleString()}`,
    `Amount         : ${fmtMoney(data.amount)}`,
    `Receiver       : ${data.receiverEmail}`,
    `Status         : Completed`,
    `Verification   : Biometric + One-time code`,
    "",
    "Thank you for using ProxiPay Mini.",
  ].join("\n");
  const blob = new Blob([lines], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `proxipay-receipt-${data.transactionId}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function Row({
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
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 truncate">
        <span
          className={`truncate ${valueClass ?? "text-foreground"} ${mono ? "font-mono text-xs" : ""}`}
        >
          {value}
        </span>
        {action}
      </span>
    </div>
  );
}

function ErrorView({
  title,
  message,
  onClose,
  closeLabel,
  onRetry,
  variant = "error",
}: {
  title: string;
  message: string;
  onClose: () => void;
  closeLabel: string;
  onRetry?: () => void;
  variant?: "error" | "warning";
}) {
  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex flex-col items-center text-center">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full animate-scale-in ${
            variant === "warning"
              ? "bg-amber-500/15 ring-2 ring-amber-500/60"
              : "bg-destructive/15 ring-2 ring-destructive/60"
          }`}
        >
          <AlertTriangle
            className={`h-8 w-8 ${variant === "warning" ? "text-amber-400" : "text-destructive"}`}
          />
        </div>
        <h3 className="mt-4 text-lg font-semibold">{title}</h3>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">{message}</p>
      </div>

      <div className={`mt-2 grid gap-2 ${onRetry ? "grid-cols-2" : ""}`}>
        <button
          onClick={onClose}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-glass-border bg-glass px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-white/10"
        >
          <X className="h-4 w-4" />
          {closeLabel}
        </button>
        {onRetry && (
          <button
            onClick={onRetry}
            className="btn-glow inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-glass-border bg-glass px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-white/10"
    >
      <X className="h-4 w-4" />
      Cancel
    </button>
  );
}

function CornerBrackets({ active }: { active: boolean }) {
  const cls = `absolute h-6 w-6 border-primary transition-opacity ${active ? "opacity-90" : "opacity-40"}`;
  return (
    <>
      <span className={`${cls} left-3 top-3 border-l-2 border-t-2 rounded-tl-lg`} />
      <span className={`${cls} right-3 top-3 border-r-2 border-t-2 rounded-tr-lg`} />
      <span className={`${cls} bottom-3 left-3 border-b-2 border-l-2 rounded-bl-lg`} />
      <span className={`${cls} bottom-3 right-3 border-b-2 border-r-2 rounded-br-lg`} />
    </>
  );
}
