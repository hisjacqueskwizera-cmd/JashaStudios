"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AlertCircle, Download, LoaderCircle, WandSparkles } from "lucide-react";
import { getBrowserTransformationInputs, listProjectCaptures } from "@/app/actions/transformation";

type CaptureOption = { id: string; createdAt: string; byteSize: number };
type Segmenter = {
  segment: (image: ImageBitmap) => { categoryMask?: { width: number; height: number; getAsUint8Array: () => Uint8Array; close?: () => void } };
  close: () => void;
};
type VisionModule = {
  FilesetResolver: { forVisionTasks: (url: string) => Promise<unknown> };
  ImageSegmenter: { createFromOptions: (fileset: unknown, options: Record<string, unknown>) => Promise<Segmenter> };
};
const VERSION = "0.10.14";
const MODULE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@" + VERSION + "/vision_bundle.mjs";
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@" + VERSION + "/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite";

async function composeInBrowser(referenceUrl: string, captureUrl: string) {
  const [referenceResponse, captureResponse] = await Promise.all([fetch(referenceUrl), fetch(captureUrl)]);
  if (!referenceResponse.ok || !captureResponse.ok) throw new Error("Could not load the selected photos. Please try again.");
  const [referenceBlob, captureBlob] = await Promise.all([referenceResponse.blob(), captureResponse.blob()]);
  const [reference, capture] = await Promise.all([createImageBitmap(referenceBlob), createImageBitmap(captureBlob)]);
  let segmenter: Segmenter | null = null;
  try {
    const vision = (await import(/* webpackIgnore: true */ MODULE_URL)) as unknown as VisionModule;
    const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL);
    const options = {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "IMAGE",
      outputCategoryMask: true,
      outputConfidenceMasks: false,
    };
    try { segmenter = await vision.ImageSegmenter.createFromOptions(fileset, options); }
    catch { segmenter = await vision.ImageSegmenter.createFromOptions(fileset, { ...options, baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" } }); }
    const result = segmenter.segment(capture);
    const categoryMask = result.categoryMask;
    if (!categoryMask) throw new Error("The browser could not create a subject mask for this photo.");
    const maskWidth = categoryMask.width, maskHeight = categoryMask.height;
    const values = categoryMask.getAsUint8Array();
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = capture.width; maskCanvas.height = capture.height;
    const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true });
    if (!maskContext) throw new Error("Canvas processing is unavailable in this browser.");
    const maskPixels = maskContext.createImageData(capture.width, capture.height);
    let left = capture.width, top = capture.height, right = 0, bottom = 0, found = false;
    for (let y = 0; y < capture.height; y++) {
      const my = Math.min(maskHeight - 1, Math.floor(y * maskHeight / capture.height));
      for (let x = 0; x < capture.width; x++) {
        const mx = Math.min(maskWidth - 1, Math.floor(x * maskWidth / capture.width));
        const person = values[my * maskWidth + mx] > 0;
        const offset = (y * capture.width + x) * 4;
        maskPixels.data[offset] = 255; maskPixels.data[offset + 1] = 255; maskPixels.data[offset + 2] = 255;
        maskPixels.data[offset + 3] = person ? 255 : 0;
        if (person) { found = true; left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
      }
    }
    categoryMask.close?.();
    if (!found || right - left < 20 || bottom - top < 20) throw new Error("No clear person was detected. Retake the photo with the subject fully visible.");
    maskContext.putImageData(maskPixels, 0, 0);

    const subjectCanvas = document.createElement("canvas");
    subjectCanvas.width = capture.width; subjectCanvas.height = capture.height;
    const subjectContext = subjectCanvas.getContext("2d");
    if (!subjectContext) throw new Error("Canvas processing is unavailable in this browser.");
    subjectContext.drawImage(capture, 0, 0);
    subjectContext.globalCompositeOperation = "destination-in";
    subjectContext.drawImage(maskCanvas, 0, 0);
    subjectContext.globalCompositeOperation = "source-over";

    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(reference.width, reference.height));
    const width = Math.max(1, Math.round(reference.width * scale));
    const height = Math.max(1, Math.round(reference.height * scale));
    const output = document.createElement("canvas");
    output.width = width; output.height = height;
    const context = output.getContext("2d");
    if (!context) throw new Error("Canvas processing is unavailable in this browser.");
    const cover = Math.max(width / reference.width, height / reference.height);
    const bgWidth = reference.width * cover, bgHeight = reference.height * cover;
    context.drawImage(reference, (width - bgWidth) / 2, (height - bgHeight) / 2, bgWidth, bgHeight);

    const cropWidth = right - left + 1, cropHeight = bottom - top + 1;
    const fitScale = Math.min((height * 0.82) / cropHeight, (width * 0.72) / cropWidth);
    const subjectWidth = cropWidth * fitScale, subjectHeight = cropHeight * fitScale;
    const destinationX = (width - subjectWidth) / 2;
    const destinationY = Math.max(0, height - subjectHeight - height * 0.035);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(subjectCanvas, left, top, cropWidth, cropHeight, destinationX, destinationY, subjectWidth, subjectHeight);
    const blob = await new Promise<Blob>((resolve, reject) => output.toBlob(value => value ? resolve(value) : reject(new Error("Could not export the composed image.")), "image/jpeg", 0.92));
    return { blob, width, height };
  } finally {
    segmenter?.close();
    reference.close();
    capture.close();
  }
}

export function TransformationPanel({
  projectId,
  selectedReference,
  captures,
}: {
  projectId: string;
  selectedReference: { id: string; name: string } | null;
  captures: CaptureOption[];
  enabled?: boolean;
}) {
  const [availableCaptures, setAvailableCaptures] = useState(captures);
  const [captureId, setCaptureId] = useState(captures[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const result = await listProjectCaptures(projectId);
      if (!active || !("success" in result) || !result.success) return;
      setAvailableCaptures(result.captures);
      setCaptureId(current => current && result.captures.some(item => item.id === current)
        ? current : (result.captures[0]?.id ?? ""));
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [projectId]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function start() {
    if (!selectedReference || !captureId) return;
    setBusy(true); setError(""); setPreviewUrl(null);
    let temporaryUrl: string | null = null;
    try {
      setStage("Securely loading your selected photos…");
      const inputs = await getBrowserTransformationInputs({ projectId, referenceImageId: selectedReference.id, capturedImageId: captureId });
      if (!("success" in inputs) || !inputs.success) throw new Error("error" in inputs ? inputs.error : "Could not load the selected photos.");
      setStage("Loading the on-device subject segmentation model…");
      const output = await composeInBrowser(inputs.referenceUrl, inputs.captureUrl);
      temporaryUrl = URL.createObjectURL(output.blob);
      setPreviewUrl(temporaryUrl);
      const link = document.createElement("a");
      link.href = temporaryUrl; link.download = "jasha-studios-composite.jpg";
      document.body.appendChild(link); link.click(); link.remove();
      setStage("Your composition is ready and downloaded. Review the result before sharing.");
    } catch (cause) {
      if (temporaryUrl) URL.revokeObjectURL(temporaryUrl);
      setError(cause instanceof Error ? cause.message : "The browser could not compose these photos.");
      setStage("");
    } finally { setBusy(false); }
  }

  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-[#171715] p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#d58a48]/10 text-[#d58a48]"><WandSparkles size={19} /></div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d58a48]">Browser-based photo composition</p>
          <h2 className="mt-1 text-xl font-semibold">Compose your capture into the reference scene</h2>
          <p className="mt-1 text-sm leading-6 text-[#8e8980]">JavaScript and MediaPipe separate the person from the capture and place the subject over the reference photo. Processing runs on your device; no Python server, vision API key or paid AI API is required. This is a basic composite, not generative image synthesis or automatic relighting.</p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/15 p-4">
          <p className="text-[10px] uppercase tracking-[0.15em] text-[#8e8980]">Selected scene reference</p>
          {selectedReference ? <p className="mt-2 truncate text-sm font-medium text-white">{selectedReference.name}</p> : <p className="mt-2 text-sm text-amber-200">Select a reference photo in Project assets first.</p>}
        </div>
        <label className="rounded-xl border border-white/10 bg-black/15 p-4">
          <span className="text-[10px] uppercase tracking-[0.15em] text-[#8e8980]">Customer capture</span>
          <select value={captureId} onChange={event => setCaptureId(event.target.value)} disabled={availableCaptures.length === 0 || busy} className="mt-2 w-full bg-transparent text-sm text-white outline-none disabled:opacity-50">
            {availableCaptures.length === 0 ? <option value="">No phone captures yet</option> : null}
            {availableCaptures.map(capture => <option key={capture.id} value={capture.id} className="bg-[#171715]">{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(capture.createdAt))} · {(capture.byteSize / 1024 / 1024).toFixed(1)} MB</option>)}
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void start()} disabled={!selectedReference || !captureId || busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#d58a48] px-5 text-sm font-semibold text-[#17130f] transition hover:bg-[#e29b5a] disabled:cursor-not-allowed disabled:opacity-45">
          {busy ? <LoaderCircle size={16} className="animate-spin" /> : <WandSparkles size={16} />}
          {busy ? "Composing on this device…" : "Compose photo"}
        </button>
        {previewUrl && <a href={previewUrl} download="jasha-studios-composite.jpg" className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-white hover:bg-white/5"><Download size={15} /> Download again</a>}
      </div>
      {stage && <p role="status" className="mt-4 text-sm text-[#c8c1b6]">{stage}</p>}
      {error && <p role="alert" className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"><AlertCircle size={15} /> {error}</p>}
      {previewUrl && <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-3"><Image src={previewUrl} alt="Browser-composed studio photograph" width={1200} height={1600} unoptimized className="mx-auto max-h-[640px] w-auto max-w-full rounded-xl object-contain" /><p className="mt-3 text-xs text-[#8e8980]">On-device composite · Review subject edges, scale and perspective before using the image.</p></div>}
    </section>
  );
}
