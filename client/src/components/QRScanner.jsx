import { useEffect, useRef, useState } from "react";
import { QrCode, Square, Video } from "lucide-react";

export default function QRScanner({ onResult, disabled }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!active) return undefined;

    let cancelled = false;
    async function start() {
      setError("");
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        readerRef.current = new BrowserQRCodeReader();
        controlsRef.current = await readerRef.current.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result) => {
            if (result && !cancelled) {
              onResult(result.getText());
              setActive(false);
            }
          }
        );
      } catch (qrError) {
        setError(qrError.message || "QR scanner is not available");
      }
    }

    start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop?.();
      controlsRef.current = null;
    };
  }, [active, onResult]);

  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Optional import</p>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">QR scanner</h2>
        </div>
        <QrCode className="h-5 w-5 text-brand-600" />
      </div>

      <div className="mt-4 aspect-video overflow-hidden rounded-lg bg-slate-950">
        {active ? (
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        ) : (
          <div className="grid h-full place-items-center text-slate-400">
            <QrCode className="h-12 w-12" />
          </div>
        )}
      </div>

      {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p> : null}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setActive((value) => !value)}
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {active ? <Square className="h-4 w-4" /> : <Video className="h-4 w-4" />}
        {active ? "Stop QR" : "Start QR"}
      </button>
    </aside>
  );
}
