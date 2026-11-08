"use server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export async function getProjectCaptures(projectId:string){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId))return {error:"Invalid project."};
 const supabase=await createSupabaseServerClient();if(!supabase)return {error:"Supabase is not configured."};
 const {data:{user},error:authError}=await supabase.auth.getUser();if(authError||!user)return {error:"Please sign in again."};
 const {data:project,error:projectError}=await supabase.from("projects").select("id").eq("id",projectId).eq("user_id",user.id).maybeSingle();
 if(projectError||!project)return {error:"Project not found."};
 const {data,error}=await supabase.from("captured_images").select("id,storage_path,byte_size,created_at").eq("project_id",projectId).eq("user_id",user.id).order("created_at",{ascending:false}).limit(12);
 if(error)return {error:"Could not load captured photos. Apply the Phase 7 migration and check Storage."};
 const bucket=supabase.storage.from("studio-assets");
 const captures=await Promise.all((data??[]).map(async row=>{
  const {data:signed}=await bucket.createSignedUrl(row.storage_path,600);
  return {id:row.id,url:signed?.signedUrl??null,createdAt:row.created_at,byteSize:Number(row.byte_size)};
 }));
 return {success:true as const,captures};
}
