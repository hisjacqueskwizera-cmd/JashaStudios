import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const landmark = z.object({
  x: z.number().finite().min(-1).max(2),
  y: z.number().finite().min(-1).max(2),
  z: z.number().finite().min(-2).max(2).optional(),
  visibility: z.number().finite().min(0).max(1).optional(),
});
const payloadSchema = z.object({
  reference_landmarks: z.array(landmark).length(33),
  captured_landmarks: z.array(landmark).length(33),
});

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid pose data." }, { status: 400 });

  const apiUrl = process.env.VISION_API_URL;
  const apiKey = process.env.VISION_API_KEY;
  if (!apiUrl || !apiKey) {
    return NextResponse.json({ error: "Python virtual photographer is not configured." }, { status: 503 });
  }

  try {
    const endpoint = new URL("/v1/analyze/virtual-photographer", apiUrl);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Python pose coaching is temporarily unavailable." }, { status: response.status >= 500 ? 503 : 422 });
    }
    return NextResponse.json(await response.json(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not reach the Python virtual photographer." }, { status: 503 });
  }
}
