import { useEffect, useState } from "react";
import { ScanFace, Check, X, Loader2 } from "lucide-react";

interface FaceAuthModalProps {
  open: boolean;
  onCancel: () => void;
  onVerified: () => void;
}

type Phase = "scanning" | "verified";

export function FaceAuthModal({ open, onCancel, onVerified }: FaceAuthModalProps) {
  const [phase, setPhase] = useState<Phase>("scanning");

  useEffect(() => {
    if (!open) return;
    setPhase("scanning");
    const t1 = setTimeout(() => setPhase("verified"), 2400);
    const t2 = setTimeout(() => onVerified(), 3400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [open, onVerified]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Face authentication"
    >
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-md"
        onClick={phase === "scanning" ? onCancel : undefined}
      />

      <div className="relative w-full max-w-md rounded-3xl border border-glass-border bg-glass p-8 shadow-2xl backdrop-blur-2xl animate-scale-in">
        <div className="mb-6 text-center">
          <h3 className="text-lg font-semibold">
            {phase === "scanning" ? "Face Authentication" : "Verified"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {phase === "scanning"
              ? "Look at the camera to confirm your payment"
              : "Identity confirmed — completing your payment"}
          </p>
        </div>

        {/* Camera frame */}
        <div className="relative mx-auto aspect-square w-56 overflow-hidden rounded-full border border-glass-border bg-black/40">
          {/* fake camera gradient */}
          <div
            className="absolute inset-0 opacity-60"
            style={{
              background:
                "radial-gradient(circle at 50% 40%, color-mix(in oklab, var(--primary) 30%, transparent), transparent 60%)",
            }}
          />

          {/* face icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            {phase === "scanning" ? (
              <ScanFace className="h-24 w-24 text-primary/80 animate-pulse" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 ring-2 ring-primary animate-scale-in">
                <Check className="h-10 w-10 text-primary" strokeWidth={3} />
              </div>
            )}
          </div>

          {/* scanning beam */}
          {phase === "scanning" && (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 animate-scan bg-gradient-to-b from-primary/80 to-transparent shadow-[0_0_20px_4px_color-mix(in_oklab,var(--primary)_50%,transparent)]" />
          )}

          {/* corner brackets */}
          <CornerBrackets active={phase === "scanning"} />
        </div>

        {/* Status row */}
        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          {phase === "scanning" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-muted-foreground">Scanning face…</span>
            </>
          ) : (
            <>
              <Check className="h-4 w-4 text-primary" />
              <span className="font-medium text-primary">
                Face Verified Successfully
              </span>
            </>
          )}
        </div>

        {/* Cancel */}
        {phase === "scanning" && (
          <button
            onClick={onCancel}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-glass-border bg-glass px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-white/10"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
        )}
      </div>
    </div>
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
