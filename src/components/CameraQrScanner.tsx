import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, CameraOff, Loader2 } from "lucide-react";

interface Props {
  onDetected: (token: string) => void;
  paused?: boolean;
}

/**
 * Real webcam / mobile-camera QR scanner using html5-qrcode.
 * - Requests camera permission on mount
 * - Prefers the rear-facing camera on mobile
 * - Fires onDetected once per scan; the parent controls re-scan via `paused`
 */
export function CameraQrScanner({ onDetected, paused }: Props) {
  const containerId = useRef(`qr-cam-${Math.random().toString(36).slice(2)}`);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const firedRef = useRef(false);
  const [status, setStatus] = useState<"idle" | "starting" | "running" | "denied" | "unavailable">(
    "idle",
  );

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      setStatus("starting");
      try {
        const instance = new Html5Qrcode(containerId.current, {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        });
        scannerRef.current = instance;

        const config = {
          fps: 10,
          qrbox: (vw: number, vh: number) => {
            const size = Math.floor(Math.min(vw, vh) * 0.75);
            return { width: size, height: size };
          },
          aspectRatio: 1,
        };

        await instance.start(
          { facingMode: { ideal: "environment" } },
          config,
          (decoded) => {
            if (firedRef.current) return;
            firedRef.current = true;
            onDetected(decoded.trim());
          },
          () => {
            /* ignore per-frame decode misses */
          },
        );
        if (cancelled) {
          try { await instance.stop(); } catch { /* noop */ }
          try { instance.clear(); } catch { /* noop */ }
          return;
        }
        setStatus("running");
      } catch (err) {
        const msg = err instanceof Error ? err.message.toLowerCase() : "";
        if (msg.includes("permission") || msg.includes("denied") || msg.includes("notallowed")) {
          setStatus("denied");
        } else {
          setStatus("unavailable");
        }
      }
    };
    start();
    return () => {
      cancelled = true;
      const inst = scannerRef.current;
      scannerRef.current = null;
      if (inst) {
        inst
          .stop()
          .catch(() => {})
          .finally(() => inst.clear().catch(() => {}));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Allow parent to reset the "fired once" guard when it asks for a rescan.
  useEffect(() => {
    if (!paused) firedRef.current = false;
  }, [paused]);

  return (
    <div className="relative h-full w-full">
      <div id={containerId.current} className="absolute inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />

      {/* Status overlays */}
      {status !== "running" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 px-4 text-center">
          {status === "starting" && (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Requesting camera…</p>
            </>
          )}
          {status === "denied" && (
            <>
              <CameraOff className="h-8 w-8 text-destructive" />
              <p className="text-xs text-destructive">Camera permission denied</p>
              <p className="text-[10px] text-muted-foreground">Paste the token below instead</p>
            </>
          )}
          {status === "unavailable" && (
            <>
              <Camera className="h-8 w-8 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">No camera available</p>
              <p className="text-[10px] text-muted-foreground">Use manual entry below</p>
            </>
          )}
        </div>
      )}

      {/* Scan line + brackets overlay (only while live) */}
      {status === "running" && !paused && (
        <>
          <div className="pointer-events-none absolute inset-x-6 top-1/2 h-0.5 -translate-y-1/2 animate-scan-line bg-primary shadow-[0_0_16px_4px_color-mix(in_oklab,var(--primary)_60%,transparent)]" />
          <div className="pointer-events-none absolute inset-0">
            <span className="absolute left-3 top-3 h-6 w-6 rounded-tl-lg border-l-2 border-t-2 border-primary" />
            <span className="absolute right-3 top-3 h-6 w-6 rounded-tr-lg border-r-2 border-t-2 border-primary" />
            <span className="absolute bottom-3 left-3 h-6 w-6 rounded-bl-lg border-b-2 border-l-2 border-primary" />
            <span className="absolute bottom-3 right-3 h-6 w-6 rounded-br-lg border-b-2 border-r-2 border-primary" />
          </div>
        </>
      )}

      {paused && status === "running" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
