# Authentication and Project Management

## Implemented

- Supabase SSR client using the public URL and anon/publishable key.
- Middleware refreshes Supabase auth cookies and validates the current user.
- Email/password sign-up and sign-in using Supabase Auth.
- Sign-out action.
- Dashboard server-loads the authenticated user's projects.
- Create, rename, archive and restore project actions.
- Zod validation for project and credential inputs.
- Every project write is scoped to the authenticated user; database RLS enforces ownership.
- Project-management migration adds owner-only insert, update and delete policies.

## Required Supabase configuration

Set these values in .env.local and in the production deployment environment:

    NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
    NEXT_PUBLIC_APP_URL=http://localhost:3000

Never put a service-role key in a NEXT_PUBLIC_ variable. Browser and SSR clients use the anon/publishable key and rely on RLS.

Apply migrations in order using the Supabase CLI:

    supabase db push

Or run both SQL migration files in timestamp order in the Supabase SQL Editor.

## Auth provider settings

In Supabase Authentication settings, enable the Email provider, configure the site URL to the deployed app URL, and add the local and production redirect URLs required by the email-confirmation policy.

Email confirmation behavior is controlled by Supabase Auth. If confirmation is required, the app displays a confirmation notice and sends the user to sign-in.

## Security notes

- Server actions call auth.getUser(); they do not trust user IDs supplied by forms.
- Every project mutation scopes by both project ID and authenticated user ID.
- RLS policies enforce ownership independently of application checks.
- No service-role credential is used by the dashboard.
- Passwords are submitted to Supabase Auth over HTTPS and are not stored by this application.
