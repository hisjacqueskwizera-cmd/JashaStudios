# Jasha Studios — Initial Architecture

## Phase 1 scope

This phase establishes application shells, shared configuration, database schema foundations, documentation and CI. It does not claim that the end-user photography workflow is operational.

## System boundaries

| Layer | Responsibility | Foundation |
|---|---|---|
| Next.js App Router | User-facing application and application workflows | Next.js 15 / React 19 / TypeScript |
| UI system | Accessible, reusable interface primitives | Tailwind CSS v4, shadcn/ui-compatible setup, Lucide |
| PWA | Installable app metadata and safe offline shell | Web manifest and service worker |
| Supabase | Authentication, PostgreSQL, object storage and realtime events | Initial SQL schema and RLS migration; live project not linked |
| FastAPI | Computer vision and image-processing API | Minimal service shell and health endpoint |
| Python modules | Isolated CV responsibilities | Analysis, pose, segmentation, processing, generation, quality and storage package boundaries |
| Worker / queue | Long-running generation jobs | Planned; Redis/Celery not activated |
| C++ extensions | Profile-proven performance-critical operations | Deferred until profiling demonstrates need |
| Hosting | Web app, API and GPU worker deployment | Planned |

## Repository layout

```text
.
├── .github/workflows/
├── docs/
├── public/
│   └── sw.js
├── python-service/
│   ├── app/
│   │   └── modules/
│   │       ├── analysis/
│   │       ├── pose/
│   │       ├── segmentation/
│   │       ├── processing/
│   │       ├── generation/
│   │       ├── quality/
│   │       └── storage/
│   └── tests/
├── src/
│   ├── app/
│   ├── components/
│   │   └── ui/
│   ├── features/
│   ├── hooks/
│   ├── lib/
│   ├── services/
│   └── types/
├── supabase/
│   └── migrations/
└── .env.example
```

## Database foundation

The initial migration creates profiles, projects, reference images and analyses, studio backgrounds and sessions, pairing challenges and paired devices, session events, captured images and analyses, processing jobs, generated images, subscriptions, credit ledger, payment transactions, notifications and administrative audit logs.

Private records are owner-scoped through RLS. Financial and sensitive workflow writes are intentionally reserved for trusted server/worker code. Profile self-service updates are limited to display name and avatar path; account status is not user-editable. Admin background management and audit reads rely on a server-controlled `app_metadata.role=admin` claim.

The migration is a starting schema, not proof that a Supabase instance is connected or that all future workflows have been tested.

## Security baseline

- Secrets are kept server-side and excluded from Git.
- The public Supabase anonymous key is intended for browser use only; database access must be constrained by RLS.
- The service-role key must never use a `NEXT_PUBLIC_` prefix.
- CORS origins are explicitly configured.
- Pairing challenge records store a hash, not the raw secret; the actual pairing flow is not implemented yet.
- API responses and private images are not cached by the service worker.
- The health endpoint reports process liveness only; it does not imply that a database, model, queue or storage service is ready.
- Ownership checks must be repeated in trusted server operations even when RLS is enabled.

## Deferred decisions

- Authentication UI/session integration and full project CRUD are later phases.
- Storage bucket policies and upload workflows will be added with the reference/capture phases.
- Queue selection and GPU deployment will be decided when a real AI provider and workload are selected.
- Model choice must be benchmarked against consented evaluation images; no provider or model quality is assumed.
- C++/pybind11 is intentionally not introduced before profiling.
