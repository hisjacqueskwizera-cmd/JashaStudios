# Phase 7 — Smartphone Camera Studio

## Delivered code
- Mobile `/camera` route with permission/error states, rear/front camera selection, live preview, capture, retake, approval and upload retry.
- JPEG capture from the browser canvas; server accepts JPEG, PNG and WebP up to 15 MiB.
- Pairing confirmation issues a random 256-bit device credential. The phone keeps the raw credential in sessionStorage; Postgres stores only its SHA-256 hash.
- Capture API validates same-origin requests, authorizes the hashed device credential through a narrow Postgres RPC, verifies file signatures, and writes to the private `studio-assets` bucket.
- Captured-image metadata is inserted server-side and uploaded objects are rolled back if metadata insertion fails.
- Desktop workspace polls the owner's capture inbox every four seconds and displays short-lived signed previews.

## Required server configuration
Set `SUPABASE_SECRET_KEY` as a server-only environment variable using a newly generated Supabase secret API key. Never prefix it with `NEXT_PUBLIC_`, expose it to the browser, commit its value, or paste it into chat. A paired phone has no desktop Supabase cookie, so the server needs this key to write to private Storage after independently authorizing the device credential and active session.

## Apply migrations
Run after Phase 6:
```powershell
npx supabase migration list --remote
npx supabase db push --dry-run --remote
npx supabase db push --remote
```
Never run `db reset --remote` against live data.

## Physical test
1. Pull latest `main`, install dependencies, configure Supabase URL/publishable key and server-only secret in ignored `.env.local`.
2. Apply migrations through Supabase CLI.
3. Set `NEXT_PUBLIC_APP_URL` to an HTTPS URL reachable from the phone. A phone cannot reach desktop `localhost`.
4. Sign in on desktop, open a project and generate a pairing QR.
5. Scan on phone, confirm pairing, open Camera Studio, grant permission, capture, retake if needed, then approve upload.
6. Confirm the image appears in the desktop Live Capture Inbox. Disconnect the device and verify subsequent uploads are rejected.

## Security and known limits
- The raw device credential is never included in the QR URL and is stored only in the phone tab's sessionStorage; closing the tab or clearing storage requires pairing again.
- Camera capture requires HTTPS (localhost is permitted for local development) and browser support for `getUserMedia`.
- This phase does not yet implement pose overlays, reference-pose matching, camera-side CV or Supabase Realtime.
- Production rate limiting, abuse monitoring, malware scanning, physical device/browser QA and live Supabase verification remain outstanding.
