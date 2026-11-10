"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Image from "next/image";
import { AlertCircle, CheckCircle2, LoaderCircle, WandSparkles, XCircle } from "lucide-react";
import {
  cancelTransformationJob,
  enqueueTransformationJob,
  getTransformationJob,
  listProjectCaptures,
} from "@/app/actions/transformation";

type CaptureOption = { id: string; createdAt: string; byteSize: number };
type JobState = {
  id: string;
  status: string;
  stage: string | null;
  progress: number | null;
  error_code: string | null;
};
type GeneratedPreview = { url: string | null; width: number | null; height: number | null };

export function TransformationPanel({
  projectId,
  selectedReference,
  captures,
  enabled,
}: {
  projectId: string;
  selectedReference: { id: string; name: string } | null;
  captures: CaptureOption[];
  enabled: boolean;
}) {
  const [availableCaptures, setAvailableCaptures] = useState(captures);
  const [captureId, setCaptureId] = useState(captures[0]?.id ?? "");
  const [job, setJob] = useState<JobState | null>(null);
  const [preview, setPreview] = useState<GeneratedPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const refreshCaptures = async () => {
      const result = await listProjectCaptures(projectId);
      if (!active || !("success" in result) || !result.success) return;
      setAvailableCaptures(result.captures);
      setCaptureId((current) =>
        current && result.captures.some((capture) => capture.id === current)
          ? current
          : (result.captures[0]?.id ?? "")
      );
    };
    void refreshCaptures();
    const timer = window.setInterval(() => void refreshCaptures(), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [projectId]);

  useEffect(() => {
    if (!job?.id || ["succeeded", "failed", "cancelled"].includes(job.status)) return;
    let active = true;
    const poll = async () => {
      const result = await getTransformationJob(job.id);
      if (!active || !("success" in result) || !result.success) return;
      setJob(result.job as JobState);
      setPreview(result.generatedImage ? {
        url: result.generatedImage.url,
        width: result.generatedImage.width,
        height: result.generatedImage.height,
      } : null);
    };
    void poll();
    let cleanupRealtime = () => {};
    try {
      const supabase = createSupabaseBrowserClient();
      const channel = supabase.channel("transformation-job-" + job.id)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "processing_jobs", filter: "id=eq." + job.id }, () => void poll())
        .subscribe();
      cleanupRealtime = () => { void supabase.removeChannel(channel); };
    } catch {}
    const timer = window.setInterval(() => void poll(), 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
      cleanupRealtime();
    };
  }, [job?.id, job?.status]);

  async function start() {
    if (!selectedReference || !captureId) return;
    setBusy(true);
    setMessage("");
    setPreview(null);
    const result = await enqueueTransformationJob({
      projectId,
      referenceImageId: selectedReference.id,
      capturedImageId: captureId,
      idempotencyKey: crypto.randomUUID(),
    });
    setBusy(false);
    if (!("success" in result) || !result.success) {
      setMessage("error" in result && result.error ? result.error : "Could not start the transformation.");
      return;
    }
    setJob({
      id: result.jobId,
      status: result.status,
      stage: "queued",
      progress: 0,
      error_code: null,
    });
    setMessage("Your photo has been added to the transformation queue.");
  }

  async function cancel() {
    if (!job) return;
    setBusy(true);
    const result = await cancelTransformationJob(job.id);
    setBusy(false);
    if ("error" in result && result.error) setMessage(result.error);
    else setMessage("Cancellation requested. The worker will discard any unpublished result.");
  }

  const running = !!job && ["queued", "reserved", "running"].includes(job.status);

  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-[#171715] p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#d58a48]/10 text-[#d58a48]">
          <WandSparkles size={19} />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d58a48]">Local photo transformation</p>
          <h2 className="mt-1 text-xl font-semibold">Compose your capture into the reference scene</h2>
          <p className="mt-1 text-sm leading-6 text-[#8e8980]">Open-source U2Net segmentation and OpenCV compositing place your captured subject into the reference scene. Your captured pixels remain the identity source. This does not synthesize a new pose or guarantee relighting; review every result.</p>
          {!enabled && <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200">Local processing is disabled until the server worker and Supabase queue are configured.</p>}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/15 p-4">
          <p className="text-[10px] uppercase tracking-[0.15em] text-[#8e8980]">Selected scene reference</p>
          {selectedReference ? (
            <p className="mt-2 truncate text-sm font-medium text-white">{selectedReference.name}</p>
          ) : (
            <p className="mt-2 text-sm text-amber-200">Select a reference photo in Project assets first.</p>
          )}
        </div>
        <label className="rounded-xl border border-white/10 bg-black/15 p-4">
          <span className="text-[10px] uppercase tracking-[0.15em] text-[#8e8980]">Customer capture</span>
          <select
            value={captureId}
            onChange={(event) => setCaptureId(event.target.value)}
            disabled={availableCaptures.length === 0 || running || busy}
            className="mt-2 w-full bg-transparent text-sm text-white outline-none disabled:opacity-50"
          >
            {availableCaptures.length === 0 ? <option value="">Waiting for a phone capture…</option> : null}
            {availableCaptures.map((capture) => (
              <option key={capture.id} value={capture.id} className="bg-[#171715]">
                {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(capture.createdAt))}
                {" · "}{(capture.byteSize / 1024 / 1024).toFixed(1)} MB
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void start()}
          disabled={!enabled || busy || running || !selectedReference || !captureId || availableCaptures.length === 0}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#d58a48] px-5 text-sm font-semibold text-[#17130f] transition hover:bg-[#e29b5a] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy ? <LoaderCircle size={16} className="animate-spin" /> : <WandSparkles size={16} />}
          {enabled ? "Start local transformation" : "Local processing unavailable"}
        </button>
        {running && (
          <button type="button" onClick={() => void cancel()} disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-[#c8c1b6] hover:bg-white/5 disabled:opacity-50">
            <XCircle size={15} /> Cancel job
          </button>
        )}
      </div>

      {message && <p role="status" className="mt-4 text-sm text-[#c8c1b6]">{message}</p>}

      {job && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {job.status === "succeeded" ? <CheckCircle2 size={17} className="text-emerald-400" /> :
                job.status === "failed" ? <AlertCircle size={17} className="text-red-300" /> :
                  job.status === "cancelled" ? <XCircle size={17} className="text-[#8e8980]" /> :
                    <LoaderCircle size={17} className="animate-spin text-[#d58a48]" />}
              <span className="text-sm font-medium capitalize text-white">{job.status}</span>
              {job.stage && <span className="text-xs text-[#8e8980]">· {job.stage.replaceAll("_", " ")}</span>}
            </div>
            <span className="text-xs tabular-nums text-[#a9a49b]">{job.progress ?? 0}%</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#d58a48] transition-all" style={{ width: `${Math.max(0, Math.min(100, job.progress ?? 0))}%` }} />
          </div>
          {job.status === "failed" && <p className="mt-3 text-xs text-amber-200">This transformation could not be completed. Review the capture quality and try again. ({job.error_code ?? "unknown_error"})</p>}
          {preview?.url && job.status === "succeeded" && (
            <div className="mt-5">
              <Image src={preview.url} alt="Local studio composite pending human review" width={1200} height={1600} unoptimized className="max-h-[560px] w-auto max-w-full rounded-xl object-contain" />
              <p className="mt-2 text-xs text-[#8e8980]">Local composite · {preview.width} × {preview.height} · Review identity, anatomy and visual quality before use.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
