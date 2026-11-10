# Jasha Studios

AI-powered virtual photography studio.

Jasha Studios helps customers recreate the photographic treatment of a reference image using their own photographs while preserving their recognizable identity.

## Current implementation

The repository includes the application foundation, Supabase Auth integration, and the desktop dashboard/project-management workflow. The repository includes the desktop-to-phone capture workflow, reference analysis, pose coaching, private image gallery and a local computer-vision transformation pipeline. The local transformation path uses rembg/U2Net segmentation and OpenCV compositing; it is not a diffusion-based generative image model. Live use still requires the owner’s Supabase project, migrations, server secrets and worker deployment.

## Technology

- Next.js App Router, React, TypeScript and Tailwind CSS
- shadcn/ui-compatible primitives and Lucide icons
- Supabase Auth, PostgreSQL and Row Level Security
- FastAPI vision service with Python/OpenCV and optional CPU-based rembg/U2Net segmentation
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

No paid external AI API or payment gateway is required. Local image transformation uses open-source segmentation and OpenCV; the first U2Net model load may need network access and sufficient CPU/RAM. Live Supabase and hosting credentials must still be configured and verified.
