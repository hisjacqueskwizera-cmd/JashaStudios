export function getPublicAppUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  if (!configured) {
    if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
    throw new Error("Production app URL is missing. Set NEXT_PUBLIC_SITE_URL.");
  }

  const url = new URL(configured.startsWith("http") ? configured : `https://${configured}`);
  if (process.env.NODE_ENV === "production" && (url.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("Production app URL must be a public HTTPS URL.");
  }
  return url.origin;
}
