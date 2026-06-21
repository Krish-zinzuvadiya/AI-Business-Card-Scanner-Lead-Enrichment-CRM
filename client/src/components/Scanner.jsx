import { useMemo, useState } from "react";
import { Camera, FileImage, Loader2, ScanLine, Sparkles, Upload, X } from "lucide-react";
import api from "../api";
import { cropToBusinessCard, fileToPreview } from "../utils/image";
import CameraCapture from "./CameraCapture";
import QRScanner from "./QRScanner";

const emptyProcessing = {
  active: false,
  title: "",
  detail: ""
};

export default function Scanner({ event, onLeadCreated }) {
  const [frontFile, setFrontFile] = useState(null);
  const [backFile, setBackFile] = useState(null);
  const [cameraSide, setCameraSide] = useState("");
  const [notes, setNotes] = useState("");
  const [processing, setProcessing] = useState(emptyProcessing);
  const [error, setError] = useState("");
  const [lastRawText, setLastRawText] = useState("");

  const frontPreview = useMemo(() => fileToPreview(frontFile), [frontFile]);
  const backPreview = useMemo(() => fileToPreview(backFile), [backFile]);

  async function handleUpload(side, file) {
    if (!file) return;
    setError("");
    const cropped = await cropToBusinessCard(file);
    if (side === "front") setFrontFile(cropped);
    if (side === "back") setBackFile(cropped);
  }

  async function submitScan(eventSubmit) {
    eventSubmit.preventDefault();
    if (!frontFile && !backFile) {
      setError("Add at least one card image.");
      return;
    }

    const formData = new FormData();
    if (frontFile) formData.append("frontImage", frontFile);
    if (backFile) formData.append("backImage", backFile);
    formData.append("notes", notes);

    setProcessing({
      active: true,
      title: "Scanning card",
      detail: "OCR, parsing, duplicate checks, and enrichment are running now."
    });
    setError("");

    try {
      const response = await api.post(`/events/${event._id}/leads/scan`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setLastRawText(response.data.rawText || "");
      setFrontFile(null);
      setBackFile(null);
      setNotes("");
      onLeadCreated(response.data.lead);
    } catch (scanError) {
      setError(scanError.message);
    } finally {
      setProcessing(emptyProcessing);
    }
  }

  async function handleQrResult(text) {
    setProcessing({
      active: true,
      title: "Importing QR lead",
      detail: "Parsing contact data and enriching missing company details."
    });
    setError("");
    try {
      const response = await api.post(`/events/${event._id}/leads/qr`, { text });
      onLeadCreated(response.data.lead);
    } catch (qrError) {
      setError(qrError.message);
    } finally {
      setProcessing(emptyProcessing);
    }
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <form onSubmit={submitScan} className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{event.name}</p>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Business card scanner</h2>
          </div>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Sparkles className="h-4 w-4" />
            Scan & Enrich
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <CardSide
            label="Front side"
            preview={frontPreview}
            onCamera={() => setCameraSide("front")}
            onUpload={(file) => handleUpload("front", file)}
            onClear={() => setFrontFile(null)}
          />
          <CardSide
            label="Back side"
            preview={backPreview}
            onCamera={() => setCameraSide("back")}
            onUpload={(file) => handleUpload("back", file)}
            onClear={() => setBackFile(null)}
          />
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="scan-notes">
            Notes
          </label>
          <textarea
            id="scan-notes"
            value={notes}
            onChange={(eventChange) => setNotes(eventChange.target.value)}
            rows={3}
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            placeholder="Meeting context, booth number, product interest"
          />
        </div>

        {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-200">{error}</p> : null}

        {lastRawText ? (
          <details className="mt-4 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
            <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-200">OCR text</summary>
            <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">{lastRawText}</pre>
          </details>
        ) : null}
      </form>

      <QRScanner onResult={handleQrResult} disabled={!event?._id || processing.active} />

      {cameraSide ? (
        <CameraCapture
          side={cameraSide}
          onCapture={(file) => {
            if (cameraSide === "front") setFrontFile(file);
            if (cameraSide === "back") setBackFile(file);
          }}
          onClose={() => setCameraSide("")}
        />
      ) : null}

      {processing.active ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 text-center shadow-soft dark:bg-slate-900">
            <Loader2 className="mx-auto h-9 w-9 animate-spin text-brand-600" />
            <h3 className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">{processing.title}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{processing.detail}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CardSide({ label, preview, onCamera, onUpload, onClear }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</p>
        {preview ? (
          <button
            type="button"
            onClick={onClear}
            className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 dark:border-slate-700"
            aria-label={`Clear ${label}`}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="card-frame overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
        {preview ? (
          <img src={preview} alt={`${label} preview`} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center px-4 text-center">
            <div>
              <FileImage className="mx-auto h-9 w-9 text-slate-400" />
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No image selected</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCamera}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Camera className="h-4 w-4" />
          Camera
        </button>
        <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
          <Upload className="h-4 w-4" />
          Upload
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => onUpload(event.target.files?.[0])}
          />
        </label>
      </div>
    </div>
  );
}
