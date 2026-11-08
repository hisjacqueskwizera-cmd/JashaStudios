"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Camera, Check, ImageOff, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { getGalleryItems, type GalleryItem } from "@/app/actions/gallery";

type Filter = "all" | "capture" | "generated";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function GalleryClient() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

  const refresh = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    const result = await getGalleryItems();
    if ("success" in result && result.success) {
      setItems(result.items);
      setRefreshedAt(result.refreshedAt);
      setError(null);
    } else if ("error" in result) {
      setError(result.error);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (document.visibilityState !== "visible" || !active) return;
      await refresh();
    };
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    const onVisibility = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const visibleItems = useMemo(
    () => filter === "all" ? items : items.filter((item) => item.kind === filter),
    [filter, items],
  );
  const capturesCount = items.filter((item) => item.kind === "capture").length;
  const generatedCount = items.filter((item) => item.kind === "generated").length;

  return (
    <section className="mt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d58a48]"><Camera size={13}/> Your studio library</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Photography gallery</h2>
          <p className="mt-1 text-sm text-[#8e8980]">Captures from your phone and finished studio images, together in one place.</p>
        </div>
        <button type="button" onClick={() => void refresh(true)} disabled={refreshing} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-xs font-medium text-[#d8d4cc] transition hover:bg-white/5 disabled:opacity-50">
          {refreshing ? <LoaderCircle size={14} className="animate-spin"/> : <RefreshCw size={14}/>} Refresh gallery
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-[#171715] p-4"><p className="text-xs text-[#8e8980]">All photos</p><p className="mt-2 text-2xl font-semibold tabular-nums">{items.length}</p></div>
        <div className="rounded-2xl border border-white/10 bg-[#171715] p-4"><p className="flex items-center gap-2 text-xs text-[#8e8980]"><Camera size={13}/> Phone captures</p><p className="mt-2 text-2xl font-semibold tabular-nums">{capturesCount}</p></div>
        <div className="rounded-2xl border border-white/10 bg-[#171715] p-4"><p className="flex items-center gap-2 text-xs text-[#8e8980]"><Sparkles size={13}/> AI results</p><p className="mt-2 text-2xl font-semibold tabular-nums">{generatedCount}</p></div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2" role="group" aria-label="Filter gallery">
        {([
          ["all", "All photos"],
          ["capture", "Phone captures"],
          ["generated", "AI results"],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value} className={`rounded-full border px-4 py-2 text-xs transition ${filter === value ? "border-[#d58a48]/50 bg-[#d58a48]/10 text-[#f0b27c]" : "border-white/10 text-[#a9a49b] hover:bg-white/5"}`}>
            {label}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-[#77736c]">{refreshedAt ? `Updated ${formatDate(refreshedAt)}` : "Syncing gallery…"}</span>
      </div>

      {error && <p role="alert" className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">{error}</p>}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-[#8e8980]"><LoaderCircle size={17} className="animate-spin"/> Loading your gallery…</div>
      ) : visibleItems.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-3xl border border-dashed border-white/10 bg-[#171715]/60 px-6 py-16 text-center">
          <ImageOff size={30} className="text-[#77736c]"/>
          <h3 className="mt-4 text-base font-medium">{filter === "generated" ? "Your AI results will appear here" : filter === "capture" ? "No phone captures yet" : "Your gallery is ready"}</h3>
          <p className="mt-2 max-w-md text-xs leading-6 text-[#8e8980]">{filter === "generated" ? "AI generation is still being connected in Phase 9. Once generated images are saved, they will automatically appear here." : "Create a project, pair your phone and approve a photograph. New captures will sync into this gallery automatically."}</p>
          <Link href="/dashboard" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#d58a48] px-4 py-2.5 text-xs font-semibold text-[#17130f]">Go to projects <ArrowUpRight size={14}/></Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visibleItems.map((item) => (
            <article key={`${item.kind}-${item.id}`} className="group overflow-hidden rounded-2xl border border-white/10 bg-[#171715]">
              {item.url ? (
                <a href={item.url} target="_blank" rel="noreferrer" aria-label={`Open ${item.kind === "capture" ? "captured" : "generated"} photo from ${item.projectName}`}>
                  <Image src={item.url} alt={item.kind === "capture" ? "Phone capture" : "AI-generated studio result"} width={900} height={1200} unoptimized className="aspect-[3/4] w-full object-cover transition duration-500 group-hover:scale-[1.025]"/>
                </a>
              ) : (
                <div className="flex aspect-[3/4] items-center justify-center text-xs text-[#8e8980]">Preview expired · refresh</div>
              )}
              <div className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] ${item.kind === "generated" ? "bg-[#d58a48]/10 text-[#e6a66c]" : "bg-white/5 text-[#b7b1a7]"}`}>
                    {item.kind === "generated" ? <Sparkles size={10}/> : <Camera size={10}/>} {item.kind === "generated" ? "AI result" : "Capture"}
                  </span>
                  {item.url && <Check size={12} className="text-emerald-300"/>}
                </div>
                <Link href={`/dashboard/projects/${item.projectId}`} className="mt-2 block truncate text-xs font-medium text-[#e8e3da] hover:text-[#e6a66c]">{item.projectName}</Link>
                <p className="mt-1 text-[10px] text-[#77736c]">{formatDate(item.createdAt)}</p>
                <p className="mt-1 text-[10px] text-[#77736c]">{item.width && item.height ? `${item.width} × ${item.height} · ` : ""}{(item.byteSize / 1024 / 1024).toFixed(1)} MB</p>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="mt-5 text-[10px] text-[#77736c]">Gallery previews use private, short-lived signed links. This page refreshes every 10 seconds while open.</p>
    </section>
  );
}
