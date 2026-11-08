# Phase 4 — Studio backgrounds and reference library

This phase adds a project workspace for the visual inputs used by later reference analysis and image transformation.

## User workflow

1. Open a project from the desktop dashboard.
2. Upload one or more reference photographs.
3. Upload custom studio backgrounds, or select an active catalog preset.
4. Select the reference image and the background to use for the project.
5. Remove unwanted uploads. Previews use short-lived signed URLs.

## Storage model

- `studio-assets` is a private Supabase Storage bucket for customer uploads.
- Object paths follow `<user_id>/<project_id>/references/<uuid>.<ext>` or `<user_id>/<project_id>/backgrounds/<uuid>.<ext>`.
- Storage RLS checks the authenticated user, project ownership and object category.
- `studio-presets` is a public-read bucket for admin-published catalog images. Only authenticated users with `app_metadata.role = admin` can write preset objects.
- Catalog metadata remains in `public.studio_backgrounds`; only active rows are shown to customers.
- Customer uploads are represented by `public.reference_images` and `public.user_studio_backgrounds`.

## Upload security

- The upload API requires an authenticated Supabase session and same-origin request.
- The API verifies project ownership before accepting an image.
- Only JPEG, PNG and WebP are accepted.
- Maximum upload size is 15 MiB.
- The API checks file signatures rather than trusting the browser-supplied MIME type alone.
- Storage writes use non-overwriting random object paths.
- If metadata insertion fails, the just-uploaded object is removed.
- Customer previews are signed for ten minutes; the private bucket is never made public.

## Apply migrations

Apply migrations in timestamp order from the repository root:

```bash
npx supabase login
npx supabase link --project-ref mhkjpzvyomecbqoyydnw
npx supabase db push
```

Alternatively, paste the SQL migration files into the Supabase SQL Editor in timestamp order:

- `20261108000100_initial_schema.sql`
- `20261108000200_project_management_policies.sql`
- `20261108000300_studio_assets.sql`

Do not apply the Phase 4 migration before the first two migrations.

## Studio preset publishing

The migration creates the `studio-presets` public-read bucket. To publish a preset:

1. Upload the preview image to `studio-presets` (for example, `portrait/seamless-warm-grey.webp`).
2. Upload the full-resolution original if different.
3. Insert an active row into `public.studio_backgrounds` with `name`, `description`, `category`, `preview_path`, `original_path`, and optional JSON lighting/style metadata.
4. Ensure the storage object is managed by an administrator. Never grant customer upload access to this bucket.

The preset UI intentionally shows an empty state until real catalog images are published; it does not invent demo backgrounds.

## Validation checklist

- [ ] Apply all migrations to the linked Supabase project.
- [ ] Sign in as User A and upload a reference image and custom background.
- [ ] Verify User A can preview, select and delete their own assets.
- [ ] Sign in as User B and verify User A's objects and metadata are inaccessible.
- [ ] Verify unsupported MIME types, spoofed file signatures and files larger than 15 MiB are rejected.
- [ ] Verify a non-owner cannot upload to or select assets in another user's project.
- [ ] Publish one preset and verify all signed-in users can view/select it, while only admins can modify its storage object.
