# Jasha Studios

AI-powered virtual photography studio.

Jasha Studios is designed to help customers recreate the photographic treatment of a reference image using their own photographs while preserving their recognizable identity.

## Current phase

**Phase 1 — project foundation and architecture.**

The current branch contains the Next.js application shell, reusable UI foundation, PWA shell, FastAPI vision-service shell, initial Supabase schema/RLS migration, CI and development documentation.

## Technology

- Next.js App Router, React, TypeScript and Tailwind CSS
- shadcn/ui-compatible component foundation and Lucide icons
- FastAPI, Pydantic, OpenCV, NumPy and Pillow
- Supabase PostgreSQL foundation and Row Level Security migration
- GitHub Actions for frontend and Python checks

## Quick start

See [Development Guide](docs/development.md) for full instructions.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Python service:

```bash
cd python-service
python -m venv .venv
# Activate the environment, then:
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Project documentation

- [Architecture](docs/architecture.md)
- [Development and installation](docs/development.md)
- [Implementation status](docs/implementation-status.md)

## Important

This is the foundation phase, not the complete photography product. Authentication, project workflows, reference analysis, QR pairing, phone camera, pose coaching, AI transformation, gallery, payments and admin functionality must be implemented and tested in subsequent phases.

No production AI provider, database connection, payment provider or GPU infrastructure is assumed to be configured until real credentials and services are supplied.
