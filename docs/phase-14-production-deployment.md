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
- Render has been selected as the Python API container host. A Render Blueprint is now included at the repository root as `render.yaml`; no Render service has been created or deployed yet.

## Architecture

1. **Frontend:** Next.js App Router on Vercel, connected to GitHub.
2. **Database and media:** Supabase PostgreSQL, Auth, Storage and Realtime.
3. **Vision API:** Python Docker container on Render with HTTPS ingress.
4. **Transformation worker:** Separate long-running process from the same Python image, deployed only after AI transformation is explicitly approved.
5. **Queue/cache:** Existing database-backed job queue is the current queue foundation. Redis is optional and is not required for the current polling worker.

Do not deploy the Python API as a Vercel Edge Function. It depends on OpenCV/Pillow and is intended to run in a persistent Python container.

## Render Blueprint

The root-level `render.yaml` defines one Docker web service:

- Service name: `jasha-vision-api`
- Region: Frankfurt
- Source branch: `main`
- Dockerfile: `python-service/Dockerfile`
- Docker build context: `python-service`
- Health check: `/health/ready`
- Automatic deploys: enabled after a commit reaches the linked branch
- Secrets: `VISION_API_KEY` and `CORS_ORIGINS` are declared as dashboard-supplied values, never committed

### Create the service in Render

1. Sign in to Render and connect the GitHub account that can access `hisjacqueskwizera-cmd/JashaStudios`.
2. Choose **New → Blueprint** and select the Jasha Studios repository and `main` branch.
3. Review the detected service from `render.yaml`; do not create a second duplicate service if one already exists.
4. Select an always-on paid instance plan appropriate for production. Do not use the Free plan for a customer-facing camera workflow: Free web services can spin down after 15 minutes of inactivity and incur cold-start delays.
5. Supply `VISION_API_KEY` as a newly generated high-entropy secret. Use the exact same value later in Vercel's server-only environment variable.
6. Supply `CORS_ORIGINS` as the exact HTTPS frontend origin after the Vercel preview/production domains are known (comma-separated only when multiple trusted origins are required). Do not use a wildcard.
7. Review all changes and create the Blueprint/service only after confirming the selected plan and any recurring cost.
8. After deployment, record the Render service URL and verify `https://<render-service-host>/health` and `/health/ready` both return HTTP 200.

Render docs:
- [Blueprint YAML reference](https://render.com/docs/blueprint-spec)
- [Docker deployments](https://render.com/docs/docker)
- [Health checks](https://render.com/docs/health-checks)
- [Environment variables and secrets](https://render.com/docs/configure-environment-variables)

### Render environment variables

| Variable | Value / handling |
|---|---|
| `APP_ENV` | `production` |
| `PORT` | `10000` (Render's default web-service port) |
| `VISION_API_KEY` | Generate a new secret in Render; never commit it |
| `CORS_ORIGINS` | Exact Vercel HTTPS origin(s), no wildcard |
| `MAX_REFERENCE_UPLOAD_BYTES` | `15728640` (15 MiB) |
| `MAX_REFERENCE_PIXELS` | `40000000` |
| `TRANSFORMATION_ENABLED` | `false` |

The Docker entrypoint now binds Uvicorn to `0.0.0.0:$PORT`, defaulting to port 10000. Its Docker health check reads the same port.

The API container does not need the Supabase secret key or OpenAI key for reference analysis. Keep those secrets out of this service unless a later, reviewed feature explicitly requires them. Do not deploy the transformation worker in this release.

## Python API image

Build from the repository root:

```bash
docker build --pull -t jasha-vision-api:<release-tag> ./python-service
```

Run locally using Render's port convention:

```bash
docker run --rm -p 10000:10000 \
  -e APP_ENV=production \
  -e PORT=10000 \
  -e VISION_API_KEY=<secret-from-secret-manager> \
  -e CORS_ORIGINS=https://<frontend-domain> \
  jasha-vision-api:<release-tag>
```

The image:
- Uses Python 3.11 slim.
- Installs runtime dependencies only.
- Runs as a non-root user.
- Exposes port 10000.
- Provides `/health` liveness and `/health/ready` readiness endpoints.
- Returns readiness 503 in production if the internal API key is missing.

## Environment variables

### Vercel — Production and Preview

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Canonical HTTPS frontend origin for the target environment |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Current publishable key only |
| `SUPABASE_SECRET_KEY` | Server-only key for trusted server actions |
| `VISION_API_URL` | HTTPS URL of the deployed Render API |
| `VISION_API_KEY` | Same secret as Render's API service |

Set the same `VISION_API_KEY` value in Vercel's server environment and the Render API secret manager. Never use a `NEXT_PUBLIC_` prefix for secrets. Use separate API keys for preview and production if the environments are separated.

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

1. Keep GitHub Actions checks required: frontend type-check, lint, Next.js build, Python tests, Python Docker build and container readiness smoke test.
2. Create the Render service from the committed Blueprint after selecting an appropriate always-on plan and adding secrets.
3. Verify the Render API health endpoints over HTTPS.
4. Create/link the Vercel project to this GitHub repository after production and preview environment values have been prepared.
5. Configure the production branch as `main`; use preview deployments for acceptance testing.
6. Confirm the frontend can reach the API with the internal key without exposing it to the browser.
7. Run smoke tests for login, project CRUD, reference analysis, QR pairing, camera upload, gallery and admin access.
8. Monitor logs and error rates before inviting customers.

Do not put a Vercel token or any Render API token in repository files. If a GitHub Actions deployment job is introduced later, store its token in a protected GitHub Environment secret, pin the CLI version, and require an environment reviewer.

## Rollback

- **Frontend:** Promote the last known-good Vercel production deployment. Confirm the prior build is compatible with the current database schema.
- **Python API:** Roll back to the previous immutable container image tag/deploy in Render.
- **Database:** Prefer forward-fix migrations. Restore from a verified backup only under an approved recovery procedure; do not assume SQL migrations are automatically reversible.
- **Secrets:** Revoke compromised keys and rotate them in the relevant secret manager. Never restore a previously exposed key.

## Smoke-test checklist

- [ ] Frontend responds over HTTPS and canonical redirects are correct.
- [ ] Python `/health` returns 200.
- [ ] Python `/health/ready` returns 200 only with production API authentication configured.
- [ ] API rejects missing and incorrect `X-API-Key` headers on protected analysis/transformation routes.
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
- [x] Added container startup/readiness smoke test to CI.
- [x] Added Render Blueprint for the Python API.
- [x] Updated the container to bind to Render's configurable `PORT`.
- [x] Documented Render, Vercel, Supabase release gates and rollback.
- [ ] Create Render service and configure secrets/plan.
- [ ] Create/link Vercel project and configure production/preview variables.
- [ ] Rotate previously exposed credentials and update hosting environments.
- [ ] Apply and verify migrations in staging.
- [ ] Complete end-to-end deployment smoke tests.
- [ ] Approve and execute production release.

Phase 14 is deployment preparation, not a claim that the application is live.
