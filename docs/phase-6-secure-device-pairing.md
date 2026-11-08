# Phase 6 — Secure QR device pairing

## Scope
Pairs one mobile browser with a project-owned studio session. Camera capture, pose coaching, image upload and realtime streaming are later phases.

## Desktop flow
1. Authenticated project owner requests a pairing challenge.
2. Next.js server generates 32 cryptographically random bytes and encodes the base64url value into a QR URL fragment.
3. Server hashes the challenge with SHA-256 and calls an owner-checked database RPC. Only the hash is stored.
4. QR challenge expires after five minutes; the studio session expires after two hours.
5. Desktop polls owner-protected status records every 2.5 seconds.
6. Owner can revoke a pending pairing or disconnect an active phone.

## Phone flow
1. Phone opens /pair#c=<challenge>.
2. Client extracts the fragment and immediately removes it from the address bar.
3. Client posts the challenge over same-origin HTTPS to the claim endpoint.
4. Server hashes the challenge and calls a narrow public database RPC. No user or project data is returned.
5. Phone displays explicit confirmation.
6. After the customer taps Confirm, an atomic single-use RPC creates the paired-device row and marks the session connected.

## Security controls
- 256-bit random challenge generated with Node cryptographic RNG.
- SHA-256 challenge hash stored in Postgres; raw challenge is not persisted.
- Five-minute challenge lifetime and two-hour session lifetime.
- URL fragment is not sent in the initial HTTP request or ordinary Referer header.
- Fragment is removed from browser history after extraction.
- Public RPCs accept only a hash and return only a boolean or connection acknowledgement.
- Atomic claim/confirmation; confirmation consumes the challenge once.
- Explicit phone-side confirmation is required.
- Owner-only challenge/session/device reads use existing RLS.
- Owner-only create/revoke functions verify auth.uid() and project ownership.
- API endpoints validate origin, request size and payload shape; responses are not cached.
- No service-role credential is used.

## Apply migration
Apply supabase/migrations/20261108000400_secure_device_pairing.sql after previous migrations:
```powershell
npx supabase db push --dry-run --remote
npx supabase db push --remote
```
Do not run db reset --remote on a database containing customer data.

## Environment
No new secret is required. Configure NEXT_PUBLIC_APP_URL to the real HTTPS origin in production. The existing Supabase URL and publishable/anon key are used. Never put a service-role key in the QR code or phone client.

## Local test
1. Start Next.js and sign in on desktop.
2. Open a non-archived project workspace and click Generate QR code.
3. Scan with a phone on a network that can reach the configured app URL. For a physical phone, localhost on the phone is not the desktop; use a reachable HTTPS development tunnel or deployed HTTPS host.
4. Confirm on the phone.
5. Verify desktop changes to Connected within a few seconds.
6. Disconnect from desktop and verify the phone is revoked.
7. Scan an expired, revoked or already-used code and verify rejection.

## Limitations
- Desktop status uses authenticated polling, not Supabase Realtime.
- Production should add edge/WAF rate limiting and security monitoring.
- Mobile page is pairing confirmation only; camera access and pose coaching are Phase 7/8.
- The migration must be applied to the live Supabase project before this works there.
