"use client";
import { useEffect,useState,useTransition } from "react";
import { AlertCircle,CheckCircle2,Clock3,LoaderCircle,QrCode,RefreshCw,ShieldCheck,Smartphone,Unplug } from "lucide-react";
import { createDevicePairing,getDevicePairingStatus,revokeDevicePairing } from "@/app/actions/device-pairing";
type PairingState={challengeId:string;sessionId:string;expiresAt:string;qrDataUrl:string;challengeStatus:string;sessionStatus:string;deviceLabel:string|null};
export function DevicePairing({projectId}:{projectId:string}){
  const [pairing,setPairing]=useState<PairingState|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [pending,startTransition]=useTransition();
  const [secondsLeft,setSecondsLeft]=useState(0);
  const connected=pairing?.sessionStatus==="connected"&&pairing.challengeStatus==="connected";
  const expired=pairing?.challengeStatus==="expired"||pairing?.challengeStatus==="revoked"||pairing?.sessionStatus==="ended";

  useEffect(()=>{
    if(!pairing||connected||expired) return;
    let active=true;
    const refresh=async()=>{
      const result=await getDevicePairingStatus({projectId,challengeId:pairing.challengeId,sessionId:pairing.sessionId});
      if(active&&"success" in result) setPairing(current=>current?{...current,challengeStatus:result.challengeStatus,sessionStatus:result.sessionStatus,expiresAt:result.expiresAt,deviceLabel:result.deviceLabel}:current);
    };
    void refresh();
    const timer=window.setInterval(()=>void refresh(),2500);
    return ()=>{active=false;window.clearInterval(timer);};
  },[projectId,pairing?.challengeId,pairing?.sessionId,pairing?.challengeStatus,pairing?.sessionStatus,connected,expired]);

  useEffect(()=>{
    if(!pairing||connected||expired) return;
    const tick=()=>setSecondsLeft(Math.max(0,Math.ceil((Date.parse(pairing.expiresAt)-Date.now())/1000)));
    tick();
    const timer=window.setInterval(tick,1000);
    return ()=>window.clearInterval(timer);
  },[pairing?.expiresAt,connected,expired]);

  function begin(){
    setError(null);
    startTransition(async()=>{
      const result=await createDevicePairing(projectId);
      if(!("success" in result)){setError(result.error||"Could not create a pairing QR code.");return;}
      setPairing({challengeId:result.challengeId,sessionId:result.sessionId,expiresAt:result.expiresAt,qrDataUrl:result.qrDataUrl,challengeStatus:"created",sessionStatus:"waiting_for_phone",deviceLabel:null});
    });
  }
  function disconnect(){
    if(!pairing)return;
    setError(null);
    startTransition(async()=>{
      const result=await revokeDevicePairing({projectId,challengeId:pairing.challengeId});
      if(!("success" in result)){setError(result.error||"Could not disconnect this device.");return;}
      setPairing(current=>current?{...current,challengeStatus:"revoked",sessionStatus:"ended"}:null);
    });
  }

  return <section className="mt-8 rounded-3xl border border-white/10 bg-[#171715] p-5 sm:p-7">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d58a48]"><Smartphone size={13}/> Capture device</p>
        <h2 className="mt-2 text-xl font-semibold">Connect your phone</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[#a9a49b]">Pair a smartphone with this project. Your phone will become the camera device for this studio session.</p></div>
      {!pairing&&<button onClick={begin} disabled={pending} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#d58a48] px-4 text-sm font-semibold text-[#17130f] disabled:opacity-60">{pending?<LoaderCircle size={16} className="animate-spin"/>:<QrCode size={16}/>} Generate QR code</button>}
    </div>
    {error&&<p role="alert" className="mt-5 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-200"><AlertCircle size={15}/>{error}</p>}
    {pairing&&<div className="mt-6 grid gap-6 border-t border-white/10 pt-6 md:grid-cols-[220px_1fr] md:items-center">
      <div className="mx-auto w-full max-w-[220px] rounded-2xl bg-white p-3">
        {connected?<div className="flex aspect-square flex-col items-center justify-center gap-3 text-center text-[#171715]"><CheckCircle2 size={52} className="text-emerald-600"/><span className="text-sm font-semibold">Phone connected</span></div>
          :expired?<div className="flex aspect-square flex-col items-center justify-center gap-3 text-center text-[#171715]"><Clock3 size={48} className="text-[#a66b37]"/><span className="text-sm font-semibold">QR code expired</span></div>
          // eslint-disable-next-line @next/next/no-img-element
          :<img src={pairing.qrDataUrl} alt="Secure phone pairing QR code" className="aspect-square w-full"/>}
      </div>
      <div>
        {connected?<><p className="flex items-center gap-2 text-sm font-semibold text-emerald-300"><ShieldCheck size={17}/> Device paired successfully</p>
          <p className="mt-2 text-sm text-[#a9a49b]">{pairing.deviceLabel||"Mobile camera"} is connected to this studio session.</p>
          <button onClick={disconnect} disabled={pending} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-[#e4c5b2] hover:bg-white/5 disabled:opacity-60"><Unplug size={15}/> Disconnect phone</button></>
        :expired?<><p className="text-sm font-semibold">This pairing code is no longer active.</p><p className="mt-2 text-sm leading-6 text-[#a9a49b]">Generate a new code to connect a phone. Each code can only be used once.</p>
          <button onClick={begin} disabled={pending} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#d58a48] px-4 text-sm font-semibold text-[#17130f] disabled:opacity-60"><RefreshCw size={15}/> Generate another code</button></>
        :<><p className="flex items-center gap-2 text-sm font-semibold"><span className={`h-2 w-2 rounded-full ${pairing.challengeStatus==="scanned"?"bg-amber-400":"bg-[#d58a48]"}`}/>{pairing.challengeStatus==="scanned"?"QR scanned — awaiting phone confirmation":"Waiting for your phone to scan"}</p>
          <p className="mt-2 text-sm leading-6 text-[#a9a49b]">Open your phone camera and scan this code. Review the request on your phone and tap Confirm to connect.</p>
          <p className="mt-4 flex items-center gap-2 text-xs text-[#8e8980]"><Clock3 size={14}/> Code expires in {Math.floor(secondsLeft/60)}:{String(secondsLeft%60).padStart(2,"0")}</p>
          <button onClick={disconnect} disabled={pending} className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-[#a9a49b] hover:bg-white/5 disabled:opacity-60">Cancel pairing</button></>}
      </div>
    </div>}
  </section>;
}
