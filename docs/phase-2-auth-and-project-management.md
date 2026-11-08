# Authentication and Project Management

## Implemented

- Supabase SSR client using the public URL and publishable key.
- Browser, server and middleware client utilities.
- Email/password sign-up and sign-in server actions.
- Auth cookie refresh middleware and email confirmation callback.
- Sign-out.
- Dashboard server-loads the authenticated user's projects.
- Create, rename, archive and restore project actions.
- Zod validation for project and credential inputs.
- Owner-scoped server actions and project RLS write policies.

## Required Supabase configuration

Create a local `.env.local` file and add:

    NEXT_PUBLIC_SUPABASE_URL=https://mhkjpzvyomecbqoyydnw.supabase.co
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
    NEXT_PUBLIC_APP_URL=http://localhost:3000

Use the publishable key (formerly anon/public key). Never put a Supabase secret/service-role key in a `NEXT_PUBLIC_` variable. The legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` variable remains supported temporarily.

For production, set the same public variables in the hosting provider's environment settings and redeploy.

Apply migrations in order using the Supabase CLI:

    supabase db push

Or run both SQL migration files in timestamp order in the Supabase SQL Editor.

In Supabase Authentication settings, enable the Email provider, configure the site URL, and allow local and production callback URLs ending in `/auth/callback`.

## Security notes

- Server actions call `auth.getUser()`; they do not trust user IDs supplied by forms.
- Every project mutation scopes by both project ID and authenticated user ID.
- RLS policies enforce ownership independently of application checks.
- No service-role credential is used by the dashboard.
- Passwords are submitted to Supabase Auth over HTTPS and are not stored by this application.
