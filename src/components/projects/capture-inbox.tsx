"use client";
import { useEffect,useState } from "react";
import Image from "next/image";
import { Camera,ImageOff,LoaderCircle } from "lucide-react";
import { getProjectCaptures } from "@/app/actions/captures";
type Capture={id:string;url:string|null;createdAt:string;byteSize:number};
export function CaptureInbox({projectId}:{projectId:string}){
 const [captures,setCaptures]=useState<Capture[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState<string|null>(null);
 useEffect(()=>{
  let active=true;
  const refresh=async()=>{
   const result=await getProjectCaptures(projectId);if(!active)return;
   if("success" in result&&result.success){setCaptures(result.captures);setError(null);}
   else if("error" in result)setError(result.error);
   setLoading(false);
  };
  void refresh();const timer=window.setInterval(()=>void refresh(),4000);
  return ()=>{active=false;window.clearInterval(timer);};
 },[projectId]);
 return <section className="mt-8 rounded-3xl border border-white/10 bg-[#171715] p-5 sm:p-7">
  <div className="flex items-center justify-between gap-3"><div><p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d58a48]"><Camera size={13}/> Live capture inbox</p><h2 className="mt-2 text-xl font-semibold">Photos from your phone</h2><p className="mt-1 text-xs text-[#8e8980]">This project checks for new captures automatically.</p></div><span className="rounded-full border border-white/10 px-3 py-1 text-[10px] text-[#a9a49b]">Auto sync · 4 sec</span></div>
  {error&&<p role="status" className="mt-4 text-xs text-amber-200">{error}</p>}
  {loading?<div className="flex items-center gap-2 py-10 text-sm text-[#8e8980]"><LoaderCircle size={16} className="animate-spin"/> Loading captures…</div>
   :captures.length===0?<div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-white/10 py-10 text-center"><ImageOff size={26} className="text-[#77736c]"/><p className="mt-3 text-sm text-[#a9a49b]">No photos captured yet</p><p className="mt-1 text-xs text-[#77736c]">Pair your phone and approve a photo to see it here.</p></div>
   :<div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{captures.map(capture=><article key={capture.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/20">{capture.url?<a href={capture.url} target="_blank" rel="noreferrer"><Image src={capture.url} alt="Captured studio photo" width={900} height={1200} unoptimized className="aspect-[3/4] w-full object-cover"/></a>:<div className="flex aspect-[3/4] items-center justify-center text-xs text-[#8e8980]">Preview expired</div>}<div className="p-2.5"><p className="text-[10px] text-[#a9a49b]">{new Intl.DateTimeFormat("en",{dateStyle:"medium",timeStyle:"short"}).format(new Date(capture.createdAt))}</p><p className="mt-1 text-[10px] text-[#77736c]">{(capture.byteSize/1024/1024).toFixed(1)} MB</p></div></article>)}</div>}
 </section>;
}
