import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X } from "lucide-react";
import { dataUrlToFile } from "../utils/image";

export default function CameraCapture({ side, onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState("");
  const [facingMode, setFacingMode] = useState("environment");

  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      stopCamera();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        });
        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (cameraError) {
        setError(cameraError.message || "Camera is not available");
      }
    }

    startCamera();

    return () => {
      mounted = false;
      stopCamera();
    };
  }, [facingMode]);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const targetRatio = 1.75;
    let sourceWidth = video.videoWidth * 0.9;
    let sourceHeight = sourceWidth / targetRatio;

    if (sourceHeight > video.videoHeight * 0.78) {
      sourceHeight = video.videoHeight * 0.78;
      sourceWidth = sourceHeight * targetRatio;
    }

    const sourceX = (video.videoWidth - sourceWidth) / 2;
    const sourceY = (video.videoHeight - sourceHeight) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = 1400;
    canvas.height = Math.round(1400 / targetRatio);
    const context = canvas.getContext("2d");
    context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    const file = dataUrlToFile(canvas.toDataURL("image/jpeg", 0.92), `${side}-business-card.jpg`);
    onCapture(file);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 px-4 py-5 text-white">
      <div className="mx-auto flex h-full max-w-5xl flex-col">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-300">Capture {side} side</p>
            <h2 className="text-xl font-semibold">Align the card inside the frame</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-lg border border-white/20 bg-white/10"
            aria-label="Close camera"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg bg-black">
          {error ? (
            <div className="grid h-full place-items-center px-6 text-center">
              <p className="max-w-md text-sm text-red-200">{error}</p>
            </div>
          ) : (
            <>
              <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="card-frame w-[90%] max-w-3xl rounded-lg border-2 border-white shadow-[0_0_0_999px_rgba(2,6,23,0.45)]" />
              </div>
            </>
          )}
        </div>

        <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <button
            type="button"
            onClick={() => setFacingMode((mode) => (mode === "environment" ? "user" : "environment"))}
            className="grid h-12 w-12 place-items-center rounded-lg border border-white/20 bg-white/10"
            aria-label="Switch camera"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={capture}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-5 font-semibold text-slate-950"
          >
            <Camera className="h-5 w-5" />
            Capture
          </button>
          <span className="h-12 w-12" />
        </div>
      </div>
    </div>
  );
}
