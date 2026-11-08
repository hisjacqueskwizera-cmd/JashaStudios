# Phase 14 — Production Deployment

## Goal

Prepare reproducible production artifacts and a safe release process for the Next.js frontend, Python vision API, Supabase database and (later) the transformation worker. This phase does not enable AI generation or payment processing.

## Current deployment discovery

- Git repository: `hisjacqueskwizera-cmd/JashaStudios`, branch `main`.
- The connected Vercel account currently has a Hobby team, but no Vercel project linked to this repository was found.
- No Jasha Studios production domain or deployment was confirmed during this phase.
- The Supabase project is known from prior setup, but migrations 001–011 have not been confirmed as applied.
- The Python vision API is a separate FastAPI service; it cannot be hosted as a long-running worker inside a standard Next.js deployment.
- A Docker production image is provided for the Python API. A worker can use the same image with a command override, but must remain stopped while transformation is disabled.

## Architecture

1. **Frontend:** Next.js App Router on Vercel, connected to GitHub.
2. **Database and media:** Supabase PostgreSQL, Auth, Storage and Realtime.
3. **Vision API:** Python Docker container on a container-capable host with HTTPS ingress.
4. **Transformation worker:** Separate long-running process from the same Python image, deployed only after AI transformation is explicitly approved.
5. **Queue/cache:** Existing database-backed job queue is the current queue foundation. Redis is optional and is not required for the current polling worker.

Do not deploy the Python API as a Vercel Edge Function. It depends on OpenCV/Pillow and is intended to run in a persistent Python container.

## Python API image

Build:

```bash
docker build --pull -t jasha-vision-api:<release-tag> ./python-service
```

Run locally:

```bash
docker run --rm -p 8000:8000 \
  -e APP_ENV=production \
  -e VISION_API_KEY=<secret-from-secret-manager> \
  -e CORS_ORIGINS=https://<frontend-domain> \
  jasha-vision-api:<release-tag>
```

The image:
- Uses Python 3.11 slim.
- Installs runtime dependencies only.
- Runs as a non-root user.
- Exposes port 8000.
- Provides `/health` liveness and `/health/ready` readiness endpoints.
- Returns readiness 503 in production if the internal API key is missing.

The API container does not need the Supabase secret key or OpenAI key for reference analysis. Keep those secrets out of this service unless a later, reviewed feature explicitly requires them.

## Environment variables

### Vercel — Production

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Canonical HTTPS frontend origin |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Current publishable key only |
| `SUPABASE_SECRET_KEY` | Server-only key for trusted server actions |
| `VISION_API_URL` | HTTPS URL of the deployed Python API |
| `VISION_API_KEY` | Secret shared with the Python API for internal requests |

Set the same `VISION_API_KEY` value in the Vercel server environment and Python API secret manager. Never use a `NEXT_PUBLIC_` prefix for secrets.

### Python API container

| Variable | Purpose |
|---|---|
| `APP_ENV` | Set to `production` |
| `VISION_API_KEY` | Internal API authentication |
| `CORS_ORIGINS` | Exact frontend origin(s), comma-separated |
| `MAX_REFERENCE_UPLOAD_BYTES` | Upload limit; default 15 MiB |
| `MAX_REFERENCE_PIXELS` | Pixel limit; default 40 million |

Do not set `TRANSFORMATION_ENABLED=true` or add the OpenAI key during this deployment phase.

### Transformation worker — not deployed yet

When separately approved, it will require `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `OPENAI_API_KEY`, a unique `TRANSFORMATION_WORKER_ID`, and worker lease/poll settings. Keep this process stopped while `TRANSFORMATION_ENABLED=false`.

## Supabase release gate

Before production:
1. Create or confirm a staging Supabase project.
2. Verify migration history with `npx supabase migration list --remote`.
3. Review `npx supabase db push --dry-run --remote`.
4. Apply pending migrations to staging only.
5. Run RLS, admin permission, account suspension, storage ownership and pairing replay/expiry tests.
6. Verify backups and a recovery procedure.
7. Only then schedule the production migration window.

Never use `supabase db reset --remote` on a database containing data. Do not apply all pending migrations to production without a staging run and backup.

## Release pipeline

1. Keep GitHub Actions checks required: frontend type-check, lint, Next.js build, Python tests and Python Docker build.
2. Connect the Vercel project to this GitHub repository after the production and preview environment values have been prepared.
3. Configure the production branch as `main`; use preview deployments for acceptance testing.
4. Require successful GitHub checks and an explicit production approval before assigning the production domain.
5. Deploy the Python API image to a container host and verify both health endpoints over HTTPS.
6. Confirm the frontend can reach the API with the internal key without exposing it to the browser.
7. Run smoke tests for login, project CRUD, reference analysis, QR pairing, camera upload, gallery and admin access.
8. Monitor logs and error rates before inviting customers.

Do not put a Vercel token in repository files. If a GitHub Actions deployment job is introduced later, store its token in a protected GitHub Environment secret, pin the Vercel CLI version, and require an environment reviewer.

## Rollback

- **Frontend:** Promote the last known-good Vercel production deployment. Confirm the prior build is compatible with the current database schema.
- **Python API:** Roll back to the previous immutable container image tag.
- **Database:** Prefer forward-fix migrations. Restore from a verified backup only under an approved recovery procedure; do not assume SQL migrations are automatically reversible.
- **Secrets:** Revoke compromised keys and rotate them in the relevant secret manager. Never restore a previously exposed key.

## Smoke-test checklist

- [ ] Frontend responds over HTTPS and canonical redirects are correct.
- [ ] Python `/health` returns 200.
- [ ] Python `/health/ready` returns 200 only with production API authentication configured.
- [ ] API rejects missing and incorrect `X-API-Key` headers.
- [ ] Auth callback and Supabase session refresh work on the deployed domain.
- [ ] RLS prevents cross-user project and media access.
- [ ] QR pairing expires, is single-use and rejects replay.
- [ ] Phone camera works over HTTPS on real iOS and Android devices.
- [ ] Upload limits, retries and signed URL expiry work.
- [ ] Admin route and privileged actions reject non-admin users.
- [ ] Error monitoring and backup alerts are active.
- [ ] AI generation and payment checkout remain disabled.

## Status

- [x] Added a non-root Python API Docker image.
- [x] Split Python runtime and test dependencies.
- [x] Added a production readiness endpoint.
- [x] Added Docker image build to GitHub Actions.
- [x] Documented Vercel, Python container, Supabase release gates and rollback.
- [ ] Create/link Vercel project and configure production/preview variables.
- [ ] Select and configure a container host for the Python API.
- [ ] Apply and verify migrations in staging.
- [ ] Complete end-to-end deployment smoke tests.
- [ ] Approve and execute production release.

Phase 14 is deployment preparation, not a claim that the application is live.
