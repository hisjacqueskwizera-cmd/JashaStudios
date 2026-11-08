import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createPublicRpcClient } from "@/lib/supabase/public-rpc";

export const runtime = "nodejs";

function fail(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer" } },
  );
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return fail("Cross-origin request rejected.", 403);
  const match = (request.headers.get("authorization") || "").match(/^Bearer ([A-Za-z0-9_-]{40,60})$/);
  if (!match) return fail("This phone is not paired.", 401);

  const rpc = createPublicRpcClient();
  if (!rpc) return fail("Pairing service is not configured.", 503);
  const tokenHash = createHash("sha256").update(match[1], "utf8").digest("hex");
  const { data, error } = await rpc.rpc("authorize_paired_device", { p_device_token_hash: tokenHash });
  const device = (Array.isArray(data) ? data[0] : data) as
    | { user_id?: string; project_id?: string }
    | null;
  if (error || !device?.user_id || !device.project_id) {
    return fail("This device session has expired or was disconnected.", 401);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return fail("Reference preview needs the server-only SUPABASE_SECRET_KEY.", 503);
  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("selected_reference_image_id")
    .eq("id", device.project_id)
    .eq("user_id", device.user_id)
    .maybeSingle();
  if (projectError) return fail("Could not read the selected project reference.", 500);
  if (!project?.selected_reference_image_id) {
    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer" },
    });
  }

  const { data: reference, error: referenceError } = await admin
    .from("reference_images")
    .select("storage_path,mime_type,byte_size")
    .eq("id", project.selected_reference_image_id)
    .eq("project_id", device.project_id)
    .eq("user_id", device.user_id)
    .maybeSingle();
  if (referenceError || !reference) return fail("The selected reference photo is unavailable.", 404);
  if (!["image/jpeg", "image/png", "image/webp"].includes(reference.mime_type)) {
    return fail("The selected reference photo has an unsupported format.", 415);
  }
  if (reference.byte_size > 15 * 1024 * 1024) return fail("The selected reference photo is too large.", 413);

  const { data: image, error: downloadError } = await admin.storage
    .from("studio-assets")
    .download(reference.storage_path);
  if (downloadError || !image) return fail("Could not retrieve the selected reference photo.", 502);

  return new NextResponse(image, {
    status: 200,
    headers: {
      "Content-Type": reference.mime_type,
      "Cache-Control": "no-store, private",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
