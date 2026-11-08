import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function matchesImageSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") {
    return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  }
  if (mimeType === "image/webp") {
    return bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) return jsonError("Invalid request origin.", 403);

  const { projectId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
    return jsonError("Invalid project.", 400);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_FILE_BYTES + 256_000) return jsonError("Image exceeds the 15 MB limit.", 413);

  const supabase = await createSupabaseServerClient();
  if (!supabase) return jsonError("Supabase is not configured.", 503);

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return jsonError("Sign in to upload project images.", 401);

  const { data: project, error: projectError } = await supabase
    .from("projects").select("id").eq("id", projectId).eq("user_id", user.id).maybeSingle();
  if (projectError || !project) return jsonError("Project not found.", 404);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Could not read the uploaded image.", 400);
  }

  const file = formData.get("file");
  const assetType = formData.get("assetType");
  if (!(file instanceof File)) return jsonError("Choose an image to upload.", 400);
  if (assetType !== "reference" && assetType !== "background") return jsonError("Invalid image category.", 400);
  if (file.size < 1 || file.size > MAX_FILE_BYTES) return jsonError("Image must be smaller than 15 MB.", 413);
  if (!allowedTypes.has(file.type)) return jsonError("Use a JPEG, PNG or WebP image.", 415);

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesImageSignature(bytes, file.type)) return jsonError("The file contents do not match the selected image type.", 415);

  const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
  const folder = assetType === "reference" ? "references" : "backgrounds";
  const storagePath = `${user.id}/${projectId}/${folder}/${crypto.randomUUID()}.${extension}`;
  const bucket = supabase.storage.from("studio-assets");

  const { error: uploadError } = await bucket.upload(storagePath, Buffer.from(bytes), {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError) return jsonError("Image upload failed. Check the storage migration and try again.", 500);

  const rawName = file.name.replace(/\.[^.]+$/, "").replace(/[\u0000-\u001f]/g, "").trim();
  const name = (rawName || (assetType === "reference" ? "Reference image" : "Studio background")).slice(0, 120);
  const metadata = {
    user_id: user.id,
    project_id: projectId,
    storage_path: storagePath,
    mime_type: file.type,
    byte_size: file.size,
  };

  const insertResult = assetType === "reference"
    ? await supabase.from("reference_images").insert(metadata)
      .select("id,storage_path,mime_type,byte_size,created_at").single()
    : await supabase.from("user_studio_backgrounds").insert({ ...metadata, name })
      .select("id,name,storage_path,mime_type,byte_size,created_at").single();

  if (insertResult.error || !insertResult.data) {
    await bucket.remove([storagePath]);
    return jsonError("Image details could not be saved. The uploaded file was rolled back.", 500);
  }

  const { data: signed } = await bucket.createSignedUrl(storagePath, 600);
  return NextResponse.json({
    asset: {
      id: insertResult.data.id,
      name: "name" in insertResult.data ? insertResult.data.name : name,
      url: signed?.signedUrl ?? null,
      mimeType: insertResult.data.mime_type,
      byteSize: insertResult.data.byte_size,
      createdAt: insertResult.data.created_at,
      type: assetType,
    },
  }, { status: 201 });
}
