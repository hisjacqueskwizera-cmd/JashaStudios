# Development Guide

## Prerequisites

- Node.js 20.9+ (recommended for Next.js 15)
- npm 10+
- Python 3.11+
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
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Windows PowerShell:

```powershell
cd python-service
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Run tests from `python-service`:

```bash
python -m pytest
```

Health check: http://127.0.0.1:8000/health

## Supabase database

The initial schema migration is in `supabase/migrations/`. It defines the Phase 1 relational foundation, ownership relationships, indexes and baseline RLS policies.

After creating a Supabase project and installing the Supabase CLI:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Do not put the service-role key in browser code. Do not disable RLS to make a query work. Review policies before adding client write paths. Financial ledger and payment writes, pairing challenge consumption, session events and processing job state are intentionally reserved for trusted server/worker code.

## Environment

Copy `.env.example` to `.env.local` for Next.js. Do not commit `.env.local`. The frontend validates public configuration with Zod at startup. Configure Python process environment separately.

The frontend foundation can start without Supabase credentials. Database connection and user workflows are not active until a real Supabase project is configured.

## PWA

The app exposes a web manifest and registers a minimal service worker. The worker caches the app entry shell for offline fallback; it deliberately does not cache API responses, authenticated data or private photographs.

## Current limits

The foundation preview is not yet a functioning photography workflow. Authentication screens and session management, project CRUD, background catalog management, reference uploads/analysis, QR pairing, camera capture, pose coaching, AI transformation, gallery, billing and admin features belong to later phases.
