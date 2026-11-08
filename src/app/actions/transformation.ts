"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,128}$/;

export async function enqueueTransformationJob(input: {
  projectId: string;
  referenceImageId: string;
  capturedImageId: string;
  idempotencyKey: string;
  styleNotes?: string;
}) {
  if (
    !UUID.test(input.projectId) ||
    !UUID.test(input.referenceImageId) ||
    !UUID.test(input.capturedImageId) ||
    !IDEMPOTENCY_KEY.test(input.idempotencyKey) ||
    (input.styleNotes?.length ?? 0) > 1000
  ) {
    return { error: "Check the selected project, images and transformation notes." as const };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "Supabase is not configured." as const };
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Please sign in again." as const };

  const { data, error } = await supabase.rpc("enqueue_transformation_job", {
    p_project_id: input.projectId,
    p_reference_image_id: input.referenceImageId,
    p_captured_image_id: input.capturedImageId,
    p_idempotency_key: input.idempotencyKey,
    p_style_notes: input.styleNotes?.trim() ?? "",
  });
  if (error) return { error: "The transformation could not be queued. Confirm the Phase 9 migration and selected reference." as const };

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.job_id) return { error: "The transformation queue returned an invalid response." as const };
  return { success: true as const, jobId: row.job_id as string, status: row.job_status as string };
}

export async function cancelTransformationJob(jobId: string) {
  if (!UUID.test(jobId)) return { error: "Invalid transformation job." as const };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "Supabase is not configured." as const };
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Please sign in again." as const };

  const { data, error } = await supabase.rpc("cancel_transformation_job", { p_job_id: jobId });
  if (error || data !== true) return { error: "This job could not be cancelled." as const };
  return { success: true as const };
}

export async function getTransformationJob(jobId: string) {
  if (!UUID.test(jobId)) return { error: "Invalid transformation job." as const };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "Supabase is not configured." as const };
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Please sign in again." as const };

  const { data: job, error } = await supabase.from("processing_jobs")
    .select("id,status,stage,progress,error_code,created_at,updated_at")
    .eq("id", jobId).eq("user_id", user.id).maybeSingle();
  if (error || !job) return { error: "Transformation job was not found." as const };

  const { data: generated, error: generatedError } = await supabase.from("generated_images")
    .select("id,storage_path,mime_type,byte_size,width,height,created_at")
    .eq("processing_job_id", jobId).eq("user_id", user.id).maybeSingle();
  if (generatedError) return { error: "The generated image record could not be loaded." as const };

  let imageUrl: string | null = null;
  if (generated?.storage_path) {
    const { data: signed, error: signedError } = await supabase.storage
      .from("studio-assets").createSignedUrl(generated.storage_path, 600);
    if (!signedError) imageUrl = signed?.signedUrl ?? null;
  }

  return {
    success: true as const,
    job,
    generatedImage: generated ? {
      id: generated.id,
      url: imageUrl,
      mimeType: generated.mime_type,
      byteSize: Number(generated.byte_size),
      width: generated.width,
      height: generated.height,
      createdAt: generated.created_at,
    } : null,
  };
}

export async function listProjectCaptures(projectId: string) {
  if (!UUID.test(projectId)) return { error: "Invalid project." as const };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "Supabase is not configured." as const };
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Please sign in again." as const };

  const { data, error } = await supabase.from("captured_images")
    .select("id,created_at,byte_size")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return { error: "Could not refresh project captures." as const };
  return {
    success: true as const,
    captures: (data ?? []).map((capture) => ({
      id: capture.id,
      createdAt: capture.created_at,
      byteSize: Number(capture.byte_size),
    })),
  };
}
