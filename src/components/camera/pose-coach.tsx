"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
type Landmark={x:number;y:number;z?:number;visibility?:number};
type PoseResult={landmarks?:Landmark[][]};
type Landmarker={detect:(image:HTMLImageElement)=>PoseResult;detectForVideo:(video:HTMLVideoElement,time:number)=>PoseResult;close:()=>void};
type VisionModule={FilesetResolver:{forVisionTasks:(url:string)=>Promise<unknown>};PoseLandmarker:{createFromOptions:(fileset:unknown,options:Record<string,unknown>)=>Promise<Landmarker>}};
const VERSION="0.10.14";
const MODULE_URL="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@"+VERSION+"/vision_bundle.mjs";
const WASM_URL="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@"+VERSION+"/wasm";
const MODEL_URL="https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const TRACKED=[11,12,13,14,15,16,23,24,25,26,27,28];
const CONNECTIONS:Array<[number,number]>=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];
function visible(point:Landmark|undefined):point is Landmark{return Boolean(point&&(point.visibility===undefined||point.visibility>=0.5));}
function normalize(points:Landmark[]){
 const cx=(points[11].x+points[12].x+points[23].x+points[24].x)/4;
 const cy=(points[11].y+points[12].y+points[23].y+points[24].y)/4;
 const sw=Math.hypot(points[11].x-points[12].x,points[11].y-points[12].y);
 const torso=Math.hypot((points[11].x+points[12].x-points[23].x-points[24].x)/2,(points[11].y+points[12].y-points[23].y-points[24].y)/2);
 const scale=Math.max(sw,torso,0.08);
 return TRACKED.map(index=>({index,x:(points[index].x-cx)/scale,y:(points[index].y-cy)/scale}));
}
function getSimilarity(current:Landmark[],target:Landmark[]){
 if(!TRACKED.every(index=>visible(current[index])&&visible(target[index])))return null;
 const a=normalize(current),b=normalize(target);
 const error=a.reduce((sum,p,i)=>sum+Math.hypot(p.x-b[i].x,p.y-b[i].y),0)/a.length;
 return Math.max(0,Math.min(100,Math.round((1-error/1.35)*100)));
}
function getGuidance(current:Landmark[],target:Landmark[]|null,score:number|null){
 if(!TRACKED.every(index=>visible(current[index])))return "Step back slightly and keep your shoulders, hips and legs visible.";
 if(!target)return "Keep your body inside the frame. Select a reference photo on desktop to match its pose.";
 if(score===null)return "Move into clear view so the coach can compare your pose.";
 const tips:string[]=[];
 for(const [index,side] of [[15,"left"],[16,"right"]] as Array<[number,string]>){
  if(current[index].y-target[index].y>0.14)tips.push("Raise your "+side+" hand");
  else if(target[index].y-current[index].y>0.14)tips.push("Lower your "+side+" hand");
 }
 const currentX=(current[11].x+current[12].x+current[23].x+current[24].x)/4;
 const targetX=(target[11].x+target[12].x+target[23].x+target[24].x)/4;
 if(currentX-targetX>0.08)tips.push("Move slightly left");
 else if(targetX-currentX>0.08)tips.push("Move slightly right");
 if(tips.length)return tips.slice(0,2).join(" · ");
 if(score>=88)return "Great match. Hold this pose and keep still.";
 if(score>=72)return "Very close. Make small adjustments to your stance.";
 return "Adjust your arm and leg positions to get closer to the reference.";
}
function draw(canvas:HTMLCanvasElement,video:HTMLVideoElement,points:Landmark[]){
 const parent=canvas.parentElement;if(!parent||!video.videoWidth||!video.videoHeight)return;
 const width=parent.clientWidth,height=parent.clientHeight,dpr=window.devicePixelRatio||1;
 if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
 const ctx=canvas.getContext("2d");if(!ctx)return;
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
 const scale=Math.max(width/video.videoWidth,height/video.videoHeight);
 const ox=(width-video.videoWidth*scale)/2,oy=(height-video.videoHeight*scale)/2;
 const xy=(p:Landmark)=>({x:p.x*video.videoWidth*scale+ox,y:p.y*video.videoHeight*scale+oy});
 ctx.lineWidth=2.5;ctx.lineCap="round";ctx.strokeStyle="rgba(230,166,108,.92)";
 for(const [from,to] of CONNECTIONS){if(!visible(points[from])||!visible(points[to]))continue;const a=xy(points[from]),b=xy(points[to]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
 ctx.fillStyle="#fff4e8";
 for(const index of TRACKED){if(!visible(points[index]))continue;const p=xy(points[index]);ctx.beginPath();ctx.arc(p.x,p.y,3.5,0,Math.PI*2);ctx.fill();}
}
export function PoseCoach({videoRef,token,active}:{videoRef:RefObject<HTMLVideoElement|null>;token:string|null;active:boolean}){
 const canvasRef=useRef<HTMLCanvasElement|null>(null);
 const [status,setStatus]=useState("Preparing pose coach…");
 const [instruction,setInstruction]=useState("Stand where your full pose is visible.");
 const [score,setScore]=useState<number|null>(null);
 const [hasReference,setHasReference]=useState(false);
 useEffect(()=>{
  const videoCandidate=videoRef.current,canvasCandidate=canvasRef.current;
  if(!active||!token||!videoCandidate||!canvasCandidate)return;
  // Capture non-null DOM elements before creating async callbacks. TypeScript
  // cannot preserve ref-derived narrowing inside the nested animation loop.
  const videoElement:HTMLVideoElement=videoCandidate;
  const canvasElement:HTMLCanvasElement=canvasCandidate;
  let cancelled=false,frameId=0,lastInference=0;
  let landmarker:Landmarker|null=null,target:Landmark[]|null=null,referenceUrl:string|null=null;
  async function initialize(){
   try{
    setStatus("Loading on-device pose model…");
    const referenceResponse=await fetch("/api/camera/reference",{headers:{Authorization:"Bearer "+token},cache:"no-store"});
    if(!referenceResponse.ok&&referenceResponse.status!==503&&referenceResponse.status!==204)throw new Error("Reference could not be loaded.");
    const vision=(await import(/* webpackIgnore: true */ MODULE_URL)) as unknown as VisionModule;
    const fileset=await vision.FilesetResolver.forVisionTasks(WASM_URL);
    const options={baseOptions:{modelAssetPath:MODEL_URL,delegate:"GPU"},runningMode:"VIDEO",numPoses:1,minPoseDetectionConfidence:0.5,minPosePresenceConfidence:0.5,minTrackingConfidence:0.5};
    try{landmarker=await vision.PoseLandmarker.createFromOptions(fileset,options);}
    catch{landmarker=await vision.PoseLandmarker.createFromOptions(fileset,{...options,baseOptions:{modelAssetPath:MODEL_URL,delegate:"CPU"}});}
    if(cancelled||!landmarker)return;
    if(referenceResponse.status===200){
     const blob=await referenceResponse.blob();referenceUrl=URL.createObjectURL(blob);
     const image=new Image();image.src=referenceUrl;await image.decode();
     target=landmarker.detect(image).landmarks?.[0]??null;
    }
    if(cancelled)return;
    setHasReference(Boolean(target));
    setStatus(target?"Live pose matching · reference loaded":"Live pose tracking · no reference selected");
    const loop=(timestamp:number)=>{
     if(cancelled||!landmarker)return;
     if(videoElement.readyState>=HTMLMediaElement.HAVE_CURRENT_DATA&&timestamp-lastInference>=120){
      lastInference=timestamp;
      const current=landmarker.detectForVideo(videoElement,timestamp).landmarks?.[0];
      if(current){draw(canvasElement,videoElement,current);const next=target?getSimilarity(current,target):null;setScore(next);setInstruction(getGuidance(current,target,next));}
      else{setScore(null);setInstruction("Step into the camera frame so your pose can be detected.");canvasElement.getContext("2d")?.clearRect(0,0,canvasElement.width,canvasElement.height);}
     }
     frameId=requestAnimationFrame(loop);
    };
    frameId=requestAnimationFrame(loop);
   }catch{
    if(!cancelled){setStatus("Pose coach unavailable");setInstruction("Check your internet connection. You can still capture normally.");}
   }
  }
  void initialize();
  return ()=>{cancelled=true;cancelAnimationFrame(frameId);landmarker?.close();if(referenceUrl)URL.revokeObjectURL(referenceUrl);canvasElement.getContext("2d")?.clearRect(0,0,canvasElement.width,canvasElement.height);};
 },[active,token,videoRef]);
 if(!active)return null;
 return <>
  <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full"/>
  <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
   <div className="max-w-[75%] rounded-xl border border-white/15 bg-black/65 px-3 py-2 backdrop-blur-sm">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#e6a66c]">{status}</p>
    <p className="mt-1 text-xs leading-5 text-white">{instruction}</p>
   </div>
   {hasReference&&score!==null&&<div className="min-w-14 rounded-xl border border-white/15 bg-black/65 px-3 py-2 text-center backdrop-blur-sm"><p className="text-lg font-semibold tabular-nums text-white">{score}%</p><p className="text-[9px] uppercase tracking-wider text-[#c3beb5]">Match</p></div>}
  </div>
 </>;
}
