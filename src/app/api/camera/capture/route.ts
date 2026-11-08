import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { createClient } from "@supabase/supabase-js";
import { NextRequest,NextResponse } from "next/server";
import { createPublicRpcClient } from "@/lib/supabase/public-rpc";
export const runtime="nodejs";
const MAX_BYTES=15*1024*1024;
const allowed=new Set(["image/jpeg","image/png","image/webp"]);
function fail(error:string,status:number){return NextResponse.json({error},{status,headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});}
function signature(bytes:Uint8Array,type:string){
 if(type==="image/jpeg")return bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(type==="image/png")return bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
 if(type==="image/webp")return bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP";
 return false;
}
export async function POST(request:NextRequest){
 if(request.headers.get("origin")!==request.nextUrl.origin)return fail("Cross-origin request rejected.",403);
 if(Number(request.headers.get("content-length")||0)>MAX_BYTES+256000)return fail("Photo exceeds the 15 MB limit.",413);
 const match=(request.headers.get("authorization")||"").match(/^Bearer ([A-Za-z0-9_-]{40,60})$/);
 if(!match)return fail("This phone is not paired. Pair it again from your desktop.",401);
 const rpc=createPublicRpcClient();if(!rpc)return fail("Pairing service is not configured.",503);
 const hash=createHash("sha256").update(match[1],"utf8").digest("hex");
 const {data,error}=await rpc.rpc("authorize_paired_device",{p_device_token_hash:hash});
 const device=Array.isArray(data)?data[0]:data;
 if(error||!device?.device_id||!device?.user_id||!device?.project_id||!device?.session_id)return fail("This device session has expired or was disconnected.",401);
 let form:FormData;try{form=await request.formData();}catch{return fail("Could not read the photo upload.",400);}
 const file=form.get("photo");
 if(!(file instanceof File))return fail("Choose a photo to upload.",400);
 if(file.size<1||file.size>MAX_BYTES)return fail("Photo must be smaller than 15 MB.",413);
 if(!allowed.has(file.type))return fail("Use a JPEG, PNG or WebP photo.",415);
 const bytes=new Uint8Array(await file.arrayBuffer());if(!signature(bytes,file.type))return fail("The photo contents do not match its file type.",415);
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const secret=process.env.SUPABASE_SECRET_KEY;
 if(!url||!secret)return fail("Camera uploads need the server-only SUPABASE_SECRET_KEY. Configure it on the server and restart the app.",503);
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const ext=file.type==="image/jpeg"?"jpg":file.type==="image/png"?"png":"webp";
 const path=device.user_id+"/"+device.project_id+"/captures/"+device.session_id+"/"+crypto.randomUUID()+"."+ext;
 const bucket=admin.storage.from("studio-assets");
 const {error:uploadError}=await bucket.upload(path,Buffer.from(bytes),{contentType:file.type,cacheControl:"3600",upsert:false});
 if(uploadError)return fail("Photo upload failed. Check Supabase Storage and retry.",500);
 const {data:record,error:recordError}=await admin.from("captured_images").insert({
  user_id:device.user_id,project_id:device.project_id,session_id:device.session_id,storage_path:path,mime_type:file.type,byte_size:file.size,
 }).select("id,created_at").single();
 if(recordError||!record){await bucket.remove([path]);return fail("Photo details could not be saved. The uploaded file was rolled back.",500);}
 await admin.from("studio_sessions").update({status:"captured"}).eq("id",device.session_id).eq("user_id",device.user_id);
 await admin.from("session_events").insert({user_id:device.user_id,session_id:device.session_id,event_type:"photo_uploaded",payload:{captured_image_id:record.id}});
 const {data:signed}=await bucket.createSignedUrl(path,600);
 return NextResponse.json({success:true,capture:{id:record.id,createdAt:record.created_at,url:signed?.signedUrl??null}},{status:201,headers:{"Cache-Control":"no-store, private","Referrer-Policy":"no-referrer"}});
}
