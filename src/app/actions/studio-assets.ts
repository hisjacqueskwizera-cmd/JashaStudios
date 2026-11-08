"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const selectionSchema = z.object({
  projectId: z.string().uuid(),
  assetId: z.string().uuid(),
  assetType: z.enum(["reference", "background", "preset"]),
});

async function getUserClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "Supabase is not configured." as const };
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: "Your session has expired. Sign in again." as const };
  return { supabase, user };
}

export async function selectProjectAsset(input: unknown) {
  const parsed = selectionSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid asset selection." };
  const { projectId, assetId, assetType } = parsed.data;
  const client = await getUserClient();
  if ("error" in client) return { error: client.error };

  if (assetType === "reference") {
    const { data, error } = await client.supabase.from("reference_images").select("id")
      .eq("id", assetId).eq("project_id", projectId).eq("user_id", client.user.id).maybeSingle();
    if (error || !data) return { error: "Reference image not found in this project." };
    const { error: updateError } = await client.supabase.from("projects")
      .update({ selected_reference_image_id: assetId }).eq("id", projectId).eq("user_id", client.user.id);
    if (updateError) return { error: "Could not select this reference image." };
  } else if (assetType === "background") {
    const { data, error } = await client.supabase.from("user_studio_backgrounds").select("id")
      .eq("id", assetId).eq("project_id", projectId).eq("user_id", client.user.id).maybeSingle();
    if (error || !data) return { error: "Background not found in this project." };
    const { error: updateError } = await client.supabase.from("projects")
      .update({ selected_user_background_id: assetId, selected_studio_background_id: null })
      .eq("id", projectId).eq("user_id", client.user.id);
    if (updateError) return { error: "Could not select this background." };
  } else {
    const { data, error } = await client.supabase.from("studio_backgrounds").select("id")
      .eq("id", assetId).eq("is_active", true).maybeSingle();
    if (error || !data) return { error: "Studio preset is unavailable." };
    const { error: updateError } = await client.supabase.from("projects")
      .update({ selected_user_background_id: null, selected_studio_background_id: assetId })
      .eq("id", projectId).eq("user_id", client.user.id);
    if (updateError) return { error: "Could not select this studio preset." };
  }

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

export async function deleteProjectAsset(input: unknown) {
  const parsed = selectionSchema.safeParse(input);
  if (!parsed.success || parsed.data.assetType === "preset") return { error: "Invalid asset." };
  const { projectId, assetId, assetType } = parsed.data;
  const client = await getUserClient();
  if ("error" in client) return { error: client.error };

  const table = assetType === "reference" ? "reference_images" : "user_studio_backgrounds";
  const { data: asset, error: readError } = await client.supabase.from(table).select("storage_path")
    .eq("id", assetId).eq("project_id", projectId).eq("user_id", client.user.id).maybeSingle();
  if (readError || !asset) return { error: "Image not found in this project." };

  const { error: storageError } = await client.supabase.storage.from("studio-assets").remove([asset.storage_path]);
  if (storageError) return { error: "The stored image could not be removed. Please retry." };

  const { error: deleteError } = await client.supabase.from(table).delete()
    .eq("id", assetId).eq("project_id", projectId).eq("user_id", client.user.id);
  if (deleteError) return { error: "Image metadata could not be removed. Refresh and retry." };

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}
