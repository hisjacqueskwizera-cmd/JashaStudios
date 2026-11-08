# Jasha Studios

AI-powered virtual photography studio.

Jasha Studios helps customers recreate the photographic treatment of a reference image using their own photographs while preserving their recognizable identity.

## Current implementation

The repository includes the application foundation, Supabase Auth integration, and the desktop dashboard/project-management workflow. The complete photography pipeline is being built phase by phase.

## Technology

- Next.js App Router, React, TypeScript and Tailwind CSS
- shadcn/ui-compatible primitives and Lucide icons
- Supabase Auth, PostgreSQL and Row Level Security
- FastAPI vision-service foundation with Python/OpenCV modules
- GitHub Actions for frontend and Python checks

## Quick start

See the Development Guide in docs/development.md.

    npm install
    cp .env.example .env.local
    npm run dev

Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then apply the SQL migrations. See docs/phase-2-auth-and-project-management.md.

## Project documentation

- docs/architecture.md
- docs/development.md
- docs/phase-2-auth-and-project-management.md
- docs/implementation-status.md

No production AI provider, live Supabase project, payment provider or GPU infrastructure is assumed to be configured until real services and credentials are supplied.
