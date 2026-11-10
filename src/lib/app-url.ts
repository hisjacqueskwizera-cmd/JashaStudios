import { headers } from "next/headers";

export async function getPublicAppUrl(): Promise<string> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const requestOrigin = host
    ? `${forwardedProtocol || (process.env.NODE_ENV === "production" ? "https" : "http")}://${host}`
    : null;

  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  const candidate = requestOrigin || configured;

  if (!candidate) {
    if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
    throw new Error("Production app URL is missing. Set NEXT_PUBLIC_SITE_URL.");
  }

  const url = new URL(candidate.startsWith("http") ? candidate : `https://${candidate}`);
  if (process.env.NODE_ENV === "production" && (url.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("Production app URL must be a public HTTPS URL.");
  }
  return url.origin;
}
