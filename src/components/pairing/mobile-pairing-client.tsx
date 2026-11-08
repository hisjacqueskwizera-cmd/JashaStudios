"use client";
import { useEffect,useRef,useState,useTransition } from "react";
import { AlertCircle,Camera,CheckCircle2,LoaderCircle,ShieldCheck,Smartphone } from "lucide-react";
type Stage="checking"|"ready"|"confirming"|"connected"|"error";
export function MobilePairingClient(){
  const challengeRef=useRef<string|null>(null);
  const [stage,setStage]=useState<Stage>("checking");
  const [deviceLabel,setDeviceLabel]=useState("Mobile camera");
  const [message,setMessage]=useState("Checking this pairing request…");
  const [pending,startTransition]=useTransition();
  useEffect(()=>{
    let active=true;
    if(!challengeRef.current){
      const params=new URLSearchParams(window.location.hash.replace(/^#/,""));
      challengeRef.current=params.get("c");
      window.history.replaceState(null,"",window.location.pathname+window.location.search);
    }
    const challenge=challengeRef.current;
    if(!challenge||!/^[A-Za-z0-9_-]{40,60}$/.test(challenge)){
      setStage("error");setMessage("This QR code is incomplete or invalid. Generate a new code on the desktop.");
      return ()=>{active=false;};
    }
    void fetch("/api/pairing/claim",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({challenge})})
      .then(async response=>{
        const payload=await response.json();
        if(!active)return;
        if(!response.ok||payload.accepted!==true){setStage("error");setMessage(payload.error||"This QR code is invalid or expired.");return;}
        setStage("ready");setMessage("The desktop is requesting to pair this phone as its camera device.");
      }).catch(()=>{
        if(!active)return;
        setStage("error");setMessage("Could not reach the pairing service. Check your connection and scan again.");
      });
    return ()=>{active=false;};
  },[]);
  function confirm(){
    const challenge=challengeRef.current;
    if(!challenge)return;
    startTransition(async()=>{
      setStage("confirming");
      const response=await fetch("/api/pairing/confirm",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({challenge,deviceLabel})});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok||payload.connected!==true){setStage("error");setMessage(payload.error||"Pairing could not be completed. Generate a new code on desktop.");return;}
      setStage("connected");setMessage("This phone is now connected to your Jasha Studios session.");
    });
  }
  const busy=stage==="checking"||stage==="confirming"||pending;
  return <main className="flex min-h-screen items-center justify-center bg-[#10100f] px-5 py-10 text-[#f4f1eb]">
    <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#171715] p-6 sm:p-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d58a48]/10 text-[#d58a48]"><Camera size={22}/></div>
      <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d58a48]">Jasha Studios · Device pairing</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Connect this phone</h1>
      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex items-start gap-3">
        {stage==="connected"?<CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-300"/>:stage==="error"?<AlertCircle size={20} className="mt-0.5 shrink-0 text-red-300"/>:busy?<LoaderCircle size={20} className="mt-0.5 shrink-0 animate-spin text-[#d58a48]"/>:<ShieldCheck size={20} className="mt-0.5 shrink-0 text-[#d58a48]"/>}
        <p className="text-sm leading-6 text-[#d8d4cc]">{message}</p></div></div>
      {stage==="ready"&&<><label htmlFor="device-label" className="mt-6 block text-xs font-medium text-[#a9a49b]">Device name</label>
        <input id="device-label" value={deviceLabel} maxLength={80} onChange={event=>setDeviceLabel(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#10100f] px-3 text-sm outline-none focus:border-[#d58a48]"/>
        <button onClick={confirm} disabled={pending} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#d58a48] px-4 text-sm font-semibold text-[#17130f] disabled:opacity-60"><Smartphone size={17}/> Confirm and connect</button>
        <p className="mt-4 text-center text-[11px] leading-5 text-[#77736c]">Only confirm if you initiated this pairing from your Jasha Studios desktop.</p></>}
      {stage==="connected"&&<div className="mt-6 rounded-xl bg-emerald-500/10 p-3 text-center text-sm text-emerald-200">Return to the desktop. Camera capture will be available in the next studio phase.</div>}
      {stage==="error"&&<p className="mt-5 text-xs leading-5 text-[#8e8980]">Pairing codes expire quickly and cannot be reused after confirmation.</p>}
    </section>
  </main>;
}
