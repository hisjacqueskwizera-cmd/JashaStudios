# Jasha Studios — Initial Architecture

## Phase 1 scope

This foundation deliberately creates only the application shells, shared configuration conventions, documentation and a health-checkable Python service. Authentication, database schema, image analysis, pairing, camera capture and generation belong to later approved phases.

## System boundaries

| Layer | Responsibility | Initial implementation |
|---|---|---|
| Next.js App Router | User-facing application and server-side application workflows | Next.js 15 / React 19 |
| Supabase | Authentication, PostgreSQL, object storage and realtime events | Planned; credentials and migrations are not yet configured |
| FastAPI | Computer vision and image-processing API | Minimal service shell and health endpoint |
| Worker / queue | Long-running generation jobs | Planned; Redis/Celery not activated |
| C++ extensions | Profile-proven performance-critical operations | Deferred until profiling demonstrates need |
| Hosting | Web app, API and GPU worker deployment | Planned; deployment configuration is not yet available |

## Repository layout

```text
.
├── docs/
├── python-service/
│   ├── app/
│   └── tests/
├── src/
│   └── app/
├── public/
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Security baseline

- Secrets are kept server-side and excluded from Git.
- The public Supabase anonymous key is intended for browser use only; database access must be constrained by Row Level Security when Supabase is introduced.
- The service-role key must never use a `NEXT_PUBLIC_` prefix.
- CORS origins are explicitly configured.
- The health endpoint reports process liveness only; it does not imply that a database, model, queue or storage service is ready.
- Ownership checks, authentication and authorization must be implemented before exposing user data or workflows.

## Configuration

Copy `.env.example` to `.env.local` for Next.js and configure local Python environment variables separately. Never commit real values.

Required to run the initial frontend: no external credentials.

Required to run the initial Python health endpoint: Python environment and the packages in `python-service/requirements.txt`.

## Deferred decisions

- Supabase schema, migrations, storage bucket names and RLS policies will be designed in the authentication/data phase.
- Queue selection and GPU deployment will be decided when a real AI provider and workload are selected.
- Model choice must be benchmarked against consented evaluation images; no provider or model quality is assumed in this foundation.
- C++/pybind11 is intentionally not introduced before profiling.
