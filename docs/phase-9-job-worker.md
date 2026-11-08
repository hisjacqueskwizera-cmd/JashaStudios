# Phase 9 — Durable transformation jobs and worker

## What this adds
- Authenticated users enqueue a job only for a project they own, its selected reference image, and one of their own captured images.
- An idempotency key prevents accidental duplicate jobs on retry.
- A Postgres RPC claims jobs atomically with `FOR UPDATE SKIP LOCKED` and a bounded lease.
- The worker downloads only owner/project-scoped private assets, validates/prepares them, calls the configured image provider, validates the returned image, and uploads WebP output to the private `studio-assets` bucket.
- A single database transaction inserts `generated_images` and marks the job succeeded.
- Failed jobs retry with a bounded attempt count; expired leases are recovered. Users can request cancellation; a result is not published after cancellation is observed.
- Worker-only RPCs are granted to `service_role`; browser users cannot write job or generated-image rows directly.

## Apply the migration
Run against staging first:
```bash
npx supabase migration list --remote
npx supabase db push --dry-run --remote
npx supabase db push --remote
```
Do not run `db reset --remote` on a live project. Verify the new functions and grants after migration.

## Worker environment
Set these only in the Python worker's secret environment:
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` — a newly rotated server-only secret key
- `OPENAI_API_KEY` — a newly rotated OpenAI key
- `OPENAI_IMAGE_MODEL`
- `TRANSFORMATION_WORKER_ID` (optional; a unique ID is generated when omitted)
- `TRANSFORMATION_POLL_INTERVAL_SECONDS` (default 3)
- `TRANSFORMATION_JOB_LEASE_SECONDS` (default 300; 60–900)
- `TRANSFORMATION_MAX_ATTEMPTS` (default 3; 1–10)
- `MAX_REFERENCE_UPLOAD_BYTES` and `MAX_REFERENCE_PIXELS`

Never put these secrets in `NEXT_PUBLIC_*`, browser code, QR payloads, or Git. The Next.js server may use the same rotated Supabase secret only for trusted upload operations; the worker needs it for private Storage and service-role RPCs.

## Run locally
From the `python-service` directory:
```bash
python -m pip install -r requirements.txt
python -m app.modules.transformation.worker
```
Run one or more worker processes; Postgres leases prevent two workers from claiming the same job. Monitor logs and process health. Do not expose the worker as a public HTTP endpoint.

## Current limitations
- The desktop enqueue/status UI is a separate integration step; this commit provides the database lifecycle and worker runtime.
- A real paid provider smoke test and consented identity/style benchmark have not been run.
- Lease recovery handles crashed workers, but a provider call may finish after a lease expires; the worker ID/lease checks prevent stale output from being published.
- Cancellation is cooperative: an in-flight provider request may finish, but its result is discarded if cancellation is recorded before publication.
- GPU-specific segmentation and identity evaluation remain future work. The current pipeline is CPU preprocessing plus managed provider generation.
