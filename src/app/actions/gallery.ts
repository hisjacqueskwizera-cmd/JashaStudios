"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type GalleryItem = {
  id: string;
  projectId: string;
  projectName: string;
  kind: "capture" | "generated";
  url: string | null;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  createdAt: string;
};

export async function getGalleryItems() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "Supabase is not configured." as const };

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Please sign in again." as const };

  const [captureResult, generatedResult] = await Promise.all([
    supabase.from("captured_images")
      .select("id,project_id,storage_path,mime_type,byte_size,width,height,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.from("generated_images")
      .select("id,project_id,storage_path,mime_type,byte_size,width,height,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  if (captureResult.error || generatedResult.error) {
    return { error: "Gallery records could not be loaded. Check that the Phase 1 and Phase 7 migrations are applied." as const };
  }

  const rows = [
    ...(captureResult.data ?? []).map((row) => ({ ...row, kind: "capture" as const })),
    ...(generatedResult.data ?? []).map((row) => ({ ...row, kind: "generated" as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 100);

  const projectIds = [...new Set(rows.map((row) => row.project_id))];
  const { data: projects, error: projectsError } = projectIds.length
    ? await supabase.from("projects").select("id,name").eq("user_id", user.id).in("id", projectIds)
    : { data: [], error: null };

  if (projectsError) return { error: "Project names could not be loaded." as const };
  const projectNames = new Map((projects ?? []).map((project) => [project.id, project.name]));
  const bucket = supabase.storage.from("studio-assets");

  const items: GalleryItem[] = await Promise.all(rows.map(async (row) => {
    const { data: signed } = await bucket.createSignedUrl(row.storage_path, 600);
    return {
      id: row.id,
      projectId: row.project_id,
      projectName: projectNames.get(row.project_id) ?? "Project",
      kind: row.kind,
      url: signed?.signedUrl ?? null,
      mimeType: row.mime_type,
      byteSize: Number(row.byte_size),
      width: row.width,
      height: row.height,
      createdAt: row.created_at,
    };
  }));

  return { success: true as const, items, refreshedAt: new Date().toISOString() };
}
