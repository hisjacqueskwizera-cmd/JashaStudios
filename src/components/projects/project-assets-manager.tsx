"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Check, ImagePlus, LoaderCircle, Plus, Trash2, UploadCloud } from "lucide-react";
import { deleteProjectAsset, selectProjectAsset } from "@/app/actions/studio-assets";

export type ProjectAssetCard = {
  id: string;
  name: string;
  url: string | null;
  mimeType: string;
  byteSize: number;
  createdAt: string;
  type: "reference" | "background" | "preset";
  selected: boolean;
};

type Props = {
  projectId: string;
  references: ProjectAssetCard[];
  backgrounds: ProjectAssetCard[];
  presets: ProjectAssetCard[];
};

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const tabs = [
  { id: "references", label: "Reference photos" },
  { id: "backgrounds", label: "Studio backgrounds" },
] as const;

type Tab = (typeof tabs)[number]["id"];

function readableSize(bytes: number) {
  if (bytes === 0) return "Studio preset";
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectAssetsManager({
  projectId,
  references,
  backgrounds,
  presets,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("references");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const currentAssets = tab === "references" ? references : backgrounds;
  const uploadType = tab === "references" ? "reference" : "background";

  async function upload(file: File | undefined) {
    if (!file) return;
    setError("");
    setMessage("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size < 1 || file.size > MAX_FILE_BYTES) {
      setError("Images must be smaller than 15 MB.");
      return;
    }

    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("assetType", uploadType);
      const response = await fetch(`/api/projects/${projectId}/assets`, {
        method: "POST",
        body,
        credentials: "same-origin",
      });
      const result = await response.json() as { asset?: unknown; error?: string };
      if (!response.ok) throw new Error(result.error || "Upload failed. Try again.");
      setMessage(tab === "references" ? "Reference photo uploaded." : "Studio background uploaded.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed. Try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function choose(asset: ProjectAssetCard) {
    setBusy(true);
    setError("");
    setMessage("");
    const result = await selectProjectAsset({
      projectId,
      assetId: asset.id,
      assetType: asset.type,
    });
    setBusy(false);
    if (result.error) setError(result.error);
    else {
      setMessage(asset.type === "reference" ? "Reference selected for this project." : "Studio background selected.");
      router.refresh();
    }
  }

  async function remove(asset: ProjectAssetCard) {
    if (!window.confirm("Delete this image from the project? This cannot be undone.")) return;
    setBusy(true);
    setError("");
    setMessage("");
    const result = await deleteProjectAsset({
      projectId,
      assetId: asset.id,
      assetType: asset.type,
    });
    setBusy(false);
    if (result.error) setError(result.error);
    else {
      setMessage("Image deleted.");
      router.refresh();
    }
  }

  return (
    <section className="mt-8">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d58a48]">Project assets</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">References & studio backgrounds</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#a9a49b]">Add the photograph whose style you want to recreate, then choose a studio background for your shoot.</p>
        </div>
        <label className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#d58a48] px-4 text-sm font-semibold text-[#17130f] transition hover:bg-[#e29b5a] ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy ? <LoaderCircle size={16} className="animate-spin" /> : <UploadCloud size={16} />}
          {tab === "references" ? "Upload reference" : "Upload background"}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(event) => void upload(event.target.files?.[0])}
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Project image library">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => { setTab(item.id); setError(""); setMessage(""); }}
            className={`rounded-xl px-4 py-2.5 text-sm transition ${tab === item.id ? "bg-white/10 text-white" : "text-[#8e8980] hover:bg-white/5 hover:text-white"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
      {message && <p role="status" className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200">{message}</p>}

      {tab === "references" ? (
        currentAssets.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-12 text-center">
            <ImagePlus size={25} className="mx-auto text-[#d58a48]" />
            <h3 className="mt-4 text-base font-medium">Add your style reference</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#8e8980]">Upload a clear photograph that shows the pose, composition, lighting and atmosphere you want to recreate. JPEG, PNG or WebP, up to 15 MB.</p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {references.map((asset) => (
              <AssetCard key={asset.id} asset={asset} busy={busy} onChoose={() => void choose(asset)} onRemove={() => void remove(asset)} />
            ))}
          </div>
        )
      ) : (
        <>
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h3 className="text-sm font-semibold">Your uploaded backgrounds</h3><p className="mt-1 text-xs text-[#8e8980]">Private to this account and project.</p></div>
              <span className="text-xs text-[#77736c]">{backgrounds.length} uploaded</span>
            </div>
            {backgrounds.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 px-5 py-7 text-center text-sm text-[#8e8980]">No custom backgrounds uploaded yet.</div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {backgrounds.map((asset) => (
                  <AssetCard key={asset.id} asset={asset} busy={busy} onChoose={() => void choose(asset)} onRemove={() => void remove(asset)} />
                ))}
              </div>
            )}
          </div>
          <div className="mt-8">
            <div className="mb-3"><h3 className="text-sm font-semibold">Studio preset library</h3><p className="mt-1 text-xs text-[#8e8980]">Curated backgrounds published by the Jasha Studios team.</p></div>
            {presets.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 px-5 py-8 text-center">
                <p className="text-sm text-[#c8c1b6]">No studio presets have been published yet.</p>
                <p className="mt-1 text-xs text-[#8e8980]">Your uploaded backgrounds are ready to use. Presets will appear here when added to the catalog.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {presets.map((asset) => (
                  <AssetCard key={asset.id} asset={asset} busy={busy} onChoose={() => void choose(asset)} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function AssetCard({
  asset,
  busy,
  onChoose,
  onRemove,
}: {
  asset: ProjectAssetCard;
  busy: boolean;
  onChoose: () => void;
  onRemove?: () => void;
}) {
  return (
    <article className={`overflow-hidden rounded-2xl border bg-[#171715] ${asset.selected ? "border-[#d58a48]/70" : "border-white/10"}`}>
      <div className="relative aspect-[4/3] bg-[#10100f]">
        {asset.url ? (
          <Image src={asset.url} alt={asset.name} fill unoptimized sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[#77736c]">Preview unavailable</div>
        )}
        {asset.selected && <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#d58a48] px-2.5 py-1 text-[11px] font-semibold text-[#17130f]"><Check size={12} /> Selected</span>}
      </div>
      <div className="p-4">
        <h4 className="truncate text-sm font-medium">{asset.name}</h4>
        <p className="mt-1 text-xs text-[#8e8980]">{readableSize(asset.byteSize)} · {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(asset.createdAt))}</p>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" disabled={busy || asset.selected} onClick={onChoose} className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-white/10 px-3 text-xs font-medium text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50">
            {asset.selected ? <><Check size={13} /> Selected</> : <><Plus size={13} /> {asset.type === "reference" ? "Use as reference" : "Use background"}</>}
          </button>
          {onRemove && <button type="button" aria-label={`Delete ${asset.name}`} title="Delete image" disabled={busy} onClick={onRemove} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-[#9e968b] hover:border-red-500/30 hover:text-red-300 disabled:opacity-50"><Trash2 size={14} /></button>}
        </div>
      </div>
    </article>
  );
}
