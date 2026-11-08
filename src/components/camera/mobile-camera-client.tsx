"use client";
import { useCallback,useEffect,useRef,useState,useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle,Camera,CheckCircle2,ChevronLeft,FlipHorizontal,LoaderCircle,RefreshCw,Upload,Video,VideoOff } from "lucide-react";
import { PoseCoach } from "@/components/camera/pose-coach";
type Facing="environment"|"user";
type CaptureState="live"|"preview"|"uploading"|"uploaded"|"error";
function subscribeDeviceToken(onStoreChange:()=>void){
 window.addEventListener("storage",onStoreChange);
 window.addEventListener("jasha-device-token-changed",onStoreChange);
 return ()=>{window.removeEventListener("storage",onStoreChange);window.removeEventListener("jasha-device-token-changed",onStoreChange);};
}
function getDeviceTokenSnapshot(){
 const stored=sessionStorage.getItem("jasha-device-token");
 return stored&&/^[A-Za-z0-9_-]{40,60}$/.test(stored)?stored:null;
}
export function MobileCameraClient(){
 const videoRef=useRef<HTMLVideoElement|null>(null);const canvasRef=useRef<HTMLCanvasElement|null>(null);
 const streamRef=useRef<MediaStream|null>(null);const previewRef=useRef<string|null>(null);
 const token=useSyncExternalStore(subscribeDeviceToken,getDeviceTokenSnapshot,()=>null);const [facing,setFacing]=useState<Facing>("environment");
 const [cameraReady,setCameraReady]=useState(false);const [cameraError,setCameraError]=useState<string|null>(null);
 const [state,setState]=useState<CaptureState>("live");const [photo,setPhoto]=useState<Blob|null>(null);const [photoUrl,setPhotoUrl]=useState<string|null>(null);
 const [message,setMessage]=useState("Allow camera access to begin.");const [devices,setDevices]=useState<MediaDeviceInfo[]>([]);const [deviceId,setDeviceId]=useState("");
 const stopCamera=useCallback(()=>{streamRef.current?.getTracks().forEach(track=>track.stop());streamRef.current=null;setCameraReady(false);},[]);
 useEffect(()=>{
  if(!token)return;let cancelled=false;
  async function start(){
   stopCamera();setCameraError(null);
   try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},deviceId:deviceId?{exact:deviceId}:undefined,width:{ideal:1920},height:{ideal:1080}}});
    if(cancelled){stream.getTracks().forEach(track=>track.stop());return;}
    streamRef.current=stream;if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play();}
    const list=await navigator.mediaDevices.enumerateDevices();if(!cancelled)setDevices(list.filter(item=>item.kind==="videoinput"));
    setCameraReady(true);setMessage("Camera ready. Frame your shot, then capture.");
   }catch(error){
    if(cancelled)return;const name=error instanceof DOMException?error.name:"";
    const text=name==="NotAllowedError"?"Camera permission was denied. Allow camera access in browser settings and retry.":name==="NotFoundError"?"No camera was found on this device.":name==="NotReadableError"?"The camera is busy in another app. Close it and retry.":"Camera access requires HTTPS (or localhost) and a supported browser.";
    setCameraError(text);setMessage(text);
   }
  }
  void start();return ()=>{cancelled=true;stopCamera();};
 },[token,facing,deviceId,stopCamera]);
 useEffect(()=>()=>{if(previewRef.current)URL.revokeObjectURL(previewRef.current);},[]);
 function capture(){
  const video=videoRef.current,canvas=canvasRef.current;if(!video||!canvas||!cameraReady||!video.videoWidth)return;
  canvas.width=video.videoWidth;canvas.height=video.videoHeight;const context=canvas.getContext("2d");if(!context)return;
  context.drawImage(video,0,0,canvas.width,canvas.height);
  canvas.toBlob(blob=>{
   if(!blob){setCameraError("Could not capture this frame. Please try again.");return;}
   if(previewRef.current)URL.revokeObjectURL(previewRef.current);
   const url=URL.createObjectURL(blob);previewRef.current=url;setPhoto(blob);setPhotoUrl(url);setState("preview");setMessage("Review your photo. Retake it or approve the upload.");
  },"image/jpeg",0.94);
 }
 function retake(){setPhoto(null);setPhotoUrl(null);setState("live");setCameraError(null);setMessage("Camera ready. Frame your shot, then capture.");}
 async function approve(){
  if(!photo||!token)return;setState("uploading");setMessage("Uploading your approved photo securely…");setCameraError(null);
  try{
   const form=new FormData();form.append("photo",photo,"capture.jpg");
   const response=await fetch("/api/camera/capture",{method:"POST",headers:{Authorization:"Bearer "+token},body:form,cache:"no-store"});
   const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||"Upload failed. Please retry.");
   setState("uploaded");setMessage("Photo uploaded. It is now available in your desktop project.");
  }catch(error){setState("error");setMessage(error instanceof Error?error.message:"Upload failed. Check your connection and retry.");}
 }
 const showPhoto=Boolean(photoUrl&&(state==="preview"||state==="uploading"||state==="uploaded"||state==="error"));
 return <main className="min-h-screen bg-[#10100f] text-[#f4f1eb]">
  <header className="flex items-center justify-between border-b border-white/10 px-4 py-4"><Link href="/pair" className="inline-flex items-center gap-2 text-xs text-[#a9a49b]"><ChevronLeft size={16}/> Pairing</Link><span className="text-[10px] font-semibold tracking-[0.2em] text-[#d58a48]">JASHA STUDIOS</span><span className="text-[10px] text-emerald-300">SECURE DEVICE</span></header>
  <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6"><div className="mb-5"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d58a48]">Mobile capture</p><h1 className="mt-2 text-2xl font-semibold">Camera studio</h1><p className="mt-1 text-sm text-[#8e8980]">Capture on your phone. Review before sending to your desktop.</p></div>
   <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#171715]">
    <div className="relative aspect-[3/4] max-h-[70vh] bg-black sm:aspect-video">
     {showPhoto?<Image src={photoUrl||""} alt="Captured photo preview" width={1600} height={2000} unoptimized className="h-full w-full object-contain"/>:<video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover"/>}
     {!showPhoto&&<PoseCoach videoRef={videoRef} token={token} active={cameraReady&&state==="live"}/>}
     {!cameraReady&&state==="live"&&<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center"><VideoOff size={32} className="text-[#8e8980]"/><p className="text-sm text-[#a9a49b]">{cameraError||(!token?"This phone is not paired. Scan a fresh QR code from your desktop first.":"Starting camera…")}</p></div>}
     {state==="uploaded"&&<div className="absolute inset-0 flex items-center justify-center bg-black/55"><div className="rounded-2xl bg-[#171715] p-6 text-center"><CheckCircle2 size={36} className="mx-auto text-emerald-300"/><p className="mt-3 text-sm font-semibold">Upload complete</p><p className="mt-1 text-xs text-[#a9a49b]">Check your desktop project.</p></div></div>}
    </div><canvas ref={canvasRef} className="hidden"/>
    <div className="p-4 sm:p-5"><div className="flex items-start gap-2 rounded-xl border border-white/10 bg-black/20 p-3"><AlertCircle size={15} className="mt-0.5 shrink-0 text-[#d58a48]"/><p className="text-xs leading-5 text-[#c3beb5]">{message}</p></div>
     <div className="mt-4 flex flex-wrap gap-2">
      {state==="live"&&<><button onClick={()=>{setDeviceId("");setFacing(value=>value==="environment"?"user":"environment");}} disabled={!cameraReady||devices.length<2} className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-xs disabled:opacity-40"><FlipHorizontal size={15}/> Switch camera</button>
       {devices.length>1&&<select aria-label="Choose camera" value={deviceId} onChange={event=>setDeviceId(event.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#10100f] px-3 text-xs"><option value="">Automatic camera</option>{devices.map(item=><option key={item.deviceId} value={item.deviceId}>{item.label||"Camera"}</option>)}</select>}
       <button onClick={capture} disabled={!cameraReady} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#d58a48] px-5 text-sm font-semibold text-[#17130f] disabled:opacity-50"><Camera size={18}/> Capture photo</button></>}
      {state==="preview"&&<><button onClick={retake} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm"><RefreshCw size={15}/> Retake</button><button onClick={approve} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#d58a48] px-4 text-sm font-semibold text-[#17130f]"><Upload size={15}/> Approve & upload</button></>}
      {state==="uploading"&&<div className="inline-flex h-11 w-full items-center justify-center gap-2 text-sm text-[#d8d4cc]"><LoaderCircle size={17} className="animate-spin"/> Uploading photo…</div>}
      {state==="uploaded"&&<><button onClick={retake} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm"><Camera size={15}/> Take another</button><button onClick={()=>{stopCamera();sessionStorage.removeItem("jasha-device-token");window.dispatchEvent(new Event("jasha-device-token-changed"));}} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm">End camera session</button></>}
      {state==="error"&&<><button onClick={approve} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#d58a48] px-4 text-sm font-semibold text-[#17130f]"><Upload size={15}/> Retry upload</button><button onClick={retake} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm"><RefreshCw size={15}/> Retake</button></>}
     </div>
     {!token&&<p className="mt-4 text-center text-xs text-[#a9a49b]">This device is not paired. <Link href="/pair" className="text-[#e6a66c] underline">Pair it again</Link>.</p>}
    </div>
   </div><p className="mt-4 flex items-center justify-center gap-2 text-center text-[10px] leading-5 text-[#77736c]"><Video size={13}/> Camera access works on HTTPS websites or localhost. Pose guidance runs on this device.</p>
  </section>
 </main>;
}
