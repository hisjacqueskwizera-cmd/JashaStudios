# Phase 13 — Security, Testing and Quality Assurance

## Objective
Harden account isolation, private media access, device pairing and request boundaries before production deployment. This phase does not activate image generation or payment processing.

## Implemented in code
- Added `public.is_active_account()`, a narrowly scoped security-definer predicate used by RLS policies to check the authenticated user's profile status without recursively invoking profile RLS.
- Rebuilt owner-read policies for projects, references, sessions, captures, processing jobs, generated images, billing records and notifications so suspended accounts lose private row access even while an old JWT remains valid.
- Applied the active-account predicate to profile updates, project writes, customer asset writes/deletes and private Storage read/write policies.
- Applied the active-account predicate to direct administrator table/storage policies and administrator RPC authorization.
- Replaced paired-device authorization so existing phone credentials stop working when the owning account is suspended.
- Required active account status inside the SECURITY DEFINER QR challenge-creation RPC.
- Added security response headers: MIME sniffing protection, frame denial, strict referrer policy, camera-only permissions policy and HSTS.
- Camera capture upload now rejects requests without a valid bounded Content-Length before parsing multipart form data.
- Added Python security-contract regression tests for these controls and for the disabled AI/payment defaults.

## Files
- `supabase/migrations/20261108001100_security_hardening.sql`
- `next.config.ts`
- `src/app/api/camera/capture/route.ts`
- `python-service/test_security_contracts.py`

## Verification
- Python security-contract tests passed in GitHub Actions for the initial Phase 13 commit.
- Frontend type-check, lint and production build must pass for the latest commit before this phase is marked CI-green.
- SQL policy behavior has not yet been exercised against a Supabase staging database.
- Physical phone upload, QR replay/expiry, account suspension with existing sessions and Storage signed URL behavior still require staging/device tests.

## Deployment notes
Apply the new migration only after reviewing the migration list and dry run in staging:

```bash
git pull origin main
npx supabase migration list --remote
npx supabase db push --dry-run --remote
npx supabase db push --remote
```

Do not use `db reset --remote` on a database containing user data. Back up the database before applying migrations. Do not enable AI transformation or payments as part of this phase.

## Remaining security work
- Configure shared edge/WAF rate limiting for public QR claim/confirm and camera upload endpoints; do not rely on per-process in-memory counters.
- Add deployed CSP after validating the MediaPipe/WASM runtime and required asset origins.
- Run Supabase integration tests for RLS, admin RPC grants, account suspension and Storage authorization.
- Perform cross-account isolation tests, QR replay/expiry tests and physical mobile-device QA.
- Verify all previously exposed Supabase/OpenAI credentials have been rotated and update hosting/worker secrets outside chat.
- Review and purge exposed credentials from Git history only with a planned, approved history rewrite.

## Status
Code changes are committed. This phase is not production-approved until the migration is applied and the staging/device checks above are completed.
