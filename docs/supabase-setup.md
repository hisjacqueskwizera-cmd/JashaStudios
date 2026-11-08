# Supabase Setup

## Packages

The application dependencies already include:

- `@supabase/supabase-js`
- `@supabase/ssr`

Install or refresh them locally with:

    npm install @supabase/supabase-js @supabase/ssr

## Environment

Create a local `.env.local` file in the repository root. Do not commit this file.

    NEXT_PUBLIC_SUPABASE_URL=https://mhkjpzvyomecbqoyydnw.supabase.co
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY

The publishable key is intended for browser use. Never substitute a Supabase secret/service-role key here. The app continues to accept the older `NEXT_PUBLIC_SUPABASE_ANON_KEY` variable as a migration fallback.

For production, add the same two public variables to the hosting provider's environment settings and redeploy.

## Supabase Next.js client utilities

- `src/lib/supabase/client.ts`: browser client for Client Components.
- `src/lib/supabase/server.ts`: request-scoped server client for Server Components and Server Actions.
- `middleware.ts`: refreshes auth cookies during requests.
- `src/app/auth/callback/route.ts`: exchanges the email confirmation PKCE code for a session.

These utilities use `@supabase/ssr` and the publishable key, following Supabase's current Next.js SSR integration pattern.

## Supabase shadcn registry

The Supabase Client for Next.js registry utility can be added to a shadcn project with:

    npx shadcn@latest add @supabase/supabase-client-nextjs

This repository already contains the equivalent Next.js browser/server/middleware client utilities, so do not overwrite the existing auth cookie handling with a duplicate implementation. The app-specific server and middleware code includes the current project auth callback and type-safe cookie adapters.

Supabase's UI Library also contains separate UI blocks for specific features (for example Auth UI, Storage uploaders and Realtime examples). Add those individually only when the corresponding Jasha Studios workflow is implemented; avoid installing unused demo blocks into the production app.

## Agent skills (optional)

For an AI coding environment that supports Agent Skills, install the Supabase guidance with:

    npx skills add supabase/agent-skills

This is optional developer tooling; it is not a runtime dependency and does not change deployed application behavior.

## Database

Apply the SQL migrations in `supabase/migrations/` to the Supabase project before testing sign-up or project CRUD. This repository contains the migration files but not the Supabase CLI local config yet. Initialize it once, then link and push the migrations:

    npx supabase init
    npx supabase login
    npx supabase link --project-ref mhkjpzvyomecbqoyydnw
    npx supabase db push

Alternatively, run the three SQL migration files in timestamp order in the Supabase SQL Editor. The project database password may be requested by the CLI; enter it locally and never paste it into chat or commit it. Configure the Supabase Auth Email provider and the allowed site/redirect URLs, including:

- Local: `http://localhost:3000/auth/callback`
- Production: `https://YOUR_APP_DOMAIN/auth/callback`

Keep Row Level Security enabled. Do not use a service-role key in browser code.
