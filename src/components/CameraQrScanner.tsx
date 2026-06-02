import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, CameraOff, Loader2 } from "lucide-react";

interface Props {
  onDetected: (token: string) => void;
  paused?: boolean;
}

/**
 * Real webcam / mobile-camera QR scanner using html5-qrcode.
 * - Requests camera permission on mount
 * - Prefers the rear-facing camera on mobile, falls back to any available device
 * - Fires onDetected once per scan; the parent controls re-scan via `paused`
 * - Cleans up safely on unmount so closing the modal never crashes the app
 */
export function CameraQrScanner({ onDetected, paused }: Props) {
  const containerId = useRef(`qr-cam-${Math.random().toString(36).slice(2)}`);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const firedRef = useRef(false);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<"idle" | "starting" | "running" | "denied" | "unavailable">(
    "idle",
  );

  // Safely stop + clear an html5-qrcode instance without ever throwing.
  const safeTeardown = async (inst: Html5Qrcode | null) => {
    if (!inst) return;
    try {
      const state = inst.getState?.();
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        await inst.stop();
      }
    } catch {
      /* ignore stop errors */
    }
    try {
      inst.clear();
    } catch {
      /* ignore clear errors (DOM may already be gone) */
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const setSafe: typeof setStatus = (s) => {
      if (mountedRef.current && !cancelled) setStatus(s);
    };

    const start = async () => {
      setSafe("starting");
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

        const onDecode = (decoded: string) => {
          if (firedRef.current || !mountedRef.current) return;
          firedRef.current = true;
          try {
            onDetected(decoded.trim());
          } catch {
            /* parent handler errors must not crash the scanner */
          }
        };

        // Try rear camera first, then any camera, then enumerate devices.
        try {
          await instance.start(
            { facingMode: { ideal: "environment" } },
            config,
            onDecode,
            () => {},
          );
        } catch {
          try {
            await instance.start({ facingMode: "user" }, config, onDecode, () => {});
          } catch {
            const devices = await Html5Qrcode.getCameras().catch(() => []);
            if (!devices || devices.length === 0) throw new Error("No camera available");
            await instance.start({ deviceId: { exact: devices[0].id } }, config, onDecode, () => {});
          }
        }

        if (cancelled || !mountedRef.current) {
          await safeTeardown(instance);
          return;
        }
        setSafe("running");
      } catch (err) {
        const msg = err instanceof Error ? err.message.toLowerCase() : "";
        if (
          msg.includes("permission") ||
          msg.includes("denied") ||
          msg.includes("notallowed")
        ) {
          setSafe("denied");
        } else {
          setSafe("unavailable");
        }
      }
    };

    void start();

    return () => {
      mountedRef.current = false;
      cancelled = true;
      const inst = scannerRef.current;
      scannerRef.current = null;
      // Fire-and-forget teardown; never let it throw into React.
      void safeTeardown(inst);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Allow parent to reset the "fired once" guard when it asks for a rescan.
  useEffect(() => {
    if (!paused) firedRef.current = false;
  }, [paused]);

  return (
    <div className="relative h-full w-full">
      <div
        id={containerId.current}
        className="absolute inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
      />

      {/* Status overlays */}
      {status !== "running" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 px-4 text-center">
          {(status === "idle" || status === "starting") && (
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
