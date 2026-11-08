# Development Guide

## Prerequisites

- Node.js 22+
- npm 10+
- Python 3.11+
- Docker (optional, for production-image testing)
- Supabase CLI (only when applying database migrations)

## Frontend

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

Checks:

```bash
npm run typecheck
npm run lint
npm run build
```

## Python vision service

Linux/macOS:

```bash
cd python-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Windows PowerShell:

```powershell
cd python-service
py -3.11 -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Run tests from `python-service`:

```bash
python -m pytest
```

Health endpoints:
- Liveness: http://127.0.0.1:8000/health
- Readiness: http://127.0.0.1:8000/health/ready

## Python container

Build from the repository root:

```bash
docker build -t jasha-vision-api:local ./python-service
docker run --rm -p 8000:8000 \
  -e APP_ENV=production \
  -e VISION_API_KEY=replace-with-a-local-test-value \
  -e CORS_ORIGINS=http://localhost:3000 \
  jasha-vision-api:local
```

The production image runs as a non-root user and contains runtime dependencies only. Do not put real credentials in Docker build arguments or image layers. Supply production secrets through the hosting platform's secret manager.

## Supabase database

The initial schema migration is in `supabase/migrations/`. It defines the relational foundation, ownership relationships, indexes and baseline RLS policies.

After creating a Supabase project and installing the Supabase CLI:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase migration list --remote
supabase db push --dry-run --remote
supabase db push --remote
```

Never use `db reset --remote` against a database containing user data. Back up the database and review the migration dry run first.

Do not put the service-role/secret key in browser code. Do not disable RLS to make a query work.

## Environment

Copy `.env.example` to `.env.local` for Next.js. Do not commit `.env.local`. Configure Python process environment separately. Production secrets must be stored in the hosting platform's encrypted environment settings.

## PWA

The app exposes a web manifest and registers a minimal service worker. The worker caches the app entry shell for offline fallback; it deliberately does not cache API responses, authenticated data or private photographs.

## Current deployment boundaries

The Next.js frontend is intended for Vercel. The Python vision API must run as a separate container service. The repository currently contains no linked Vercel project or production domain configuration. Database migrations and live Supabase workflows must be verified in staging before a production release.

AI transformation remains disabled by default. No payment gateway is configured.
