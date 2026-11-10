"use server";
import { getPublicAppUrl } from "@/lib/app-url";
import { createHash, randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
const projectIdSchema=z.string().uuid();
const statusSchema=z.object({projectId:z.string().uuid(),challengeId:z.string().uuid(),sessionId:z.string().uuid()});
const revokeSchema=z.object({projectId:z.string().uuid(),challengeId:z.string().uuid()});
async function getClient(){
 const supabase=await createSupabaseServerClient();
 if(!supabase)return {error:"Supabase is not configured." as const};
 const {data:{user},error}=await supabase.auth.getUser();
 if(error||!user)return {error:"Please sign in again." as const};
 return {supabase,user};
}
export async function createDevicePairing(input:unknown){
 const parsed=projectIdSchema.safeParse(input);if(!parsed.success)return {error:"Invalid project."};
 const client=await getClient();if("error" in client)return {error:client.error};
 const {data:project,error:projectError}=await client.supabase.from("projects").select("id").eq("id",parsed.data).eq("user_id",client.user.id).is("archived_at",null).maybeSingle();
 if(projectError||!project)return {error:"Project not found or unavailable."};
 const secret=randomBytes(32).toString("base64url");
 const secretHash=createHash("sha256").update(secret,"utf8").digest("hex");
 let appUrl:string;try{appUrl=getPublicAppUrl();}catch{return {error:"The public app URL is not configured. Set NEXT_PUBLIC_SITE_URL and retry."};}
 const expiresAt=new Date(Date.now()+5*60*1000).toISOString();
 const {data,error}=await client.supabase.rpc("create_pairing_challenge",{p_project_id:parsed.data,p_secret_hash:secretHash,p_expires_at:expiresAt}).single();
 const row=data as unknown as {created_challenge_id:string;created_session_id:string;challenge_expires_at:string}|null;
 if(error||!row?.created_challenge_id||!row.created_session_id||!row.challenge_expires_at)return {error:"Could not create a secure pairing session. Check that the Phase 6 migration is applied."};
 try{
  const pairingUrl=new URL("/pair",appUrl);pairingUrl.hash=new URLSearchParams({c:secret}).toString();
  const qrDataUrl=await QRCode.toDataURL(pairingUrl.toString(),{errorCorrectionLevel:"M",margin:2,width:320,color:{dark:"#171715",light:"#FFFFFF"}});
  return {success:true as const,challengeId:row.created_challenge_id,sessionId:row.created_session_id,expiresAt:row.challenge_expires_at,qrDataUrl};
 }catch{
  await client.supabase.rpc("revoke_pairing_challenge",{p_challenge_id:row.created_challenge_id});
  return {error:"The QR code could not be generated. Please retry."};
 }
}
export async function getDevicePairingStatus(input:unknown){
 const parsed=statusSchema.safeParse(input);if(!parsed.success)return {error:"Invalid pairing session."};
 const client=await getClient();if("error" in client)return {error:client.error};
 const [{data:challenge,error:challengeError},{data:session,error:sessionError},{data:device}]=await Promise.all([
  client.supabase.from("pairing_challenges").select("status,expires_at").eq("id",parsed.data.challengeId).eq("session_id",parsed.data.sessionId).eq("user_id",client.user.id).maybeSingle(),
  client.supabase.from("studio_sessions").select("status").eq("id",parsed.data.sessionId).eq("project_id",parsed.data.projectId).eq("user_id",client.user.id).maybeSingle(),
  client.supabase.from("paired_devices").select("device_label").eq("session_id",parsed.data.sessionId).eq("user_id",client.user.id).is("revoked_at",null).maybeSingle(),
 ]);
 if(challengeError||sessionError||!challenge||!session)return {error:"Pairing session could not be found."};
 const expired=Date.parse(challenge.expires_at)<=Date.now()&&["created","scanned"].includes(challenge.status);
 return {success:true as const,challengeStatus:expired?"expired":challenge.status,sessionStatus:session.status,expiresAt:challenge.expires_at,deviceLabel:device?.device_label??null};
}
export async function revokeDevicePairing(input:unknown){
 const parsed=revokeSchema.safeParse(input);if(!parsed.success)return {error:"Invalid pairing session."};
 const client=await getClient();if("error" in client)return {error:client.error};
 const {data,error}=await client.supabase.rpc("revoke_pairing_challenge",{p_challenge_id:parsed.data.challengeId});
 if(error||data!==true)return {error:"The device could not be disconnected. Refresh and retry."};
 return {success:true as const};
}
