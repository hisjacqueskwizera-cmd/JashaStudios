-- Fix Storage RLS path resolution for private studio uploads.
-- Qualify storage.objects.name inside the projects subquery. An unqualified
-- name resolves to projects.name in the nested query and rejects valid UUID paths.

drop policy if exists studio_assets_owner_read on storage.objects;
create policy studio_assets_owner_read on storage.objects
for select to authenticated
using (
  bucket_id = 'studio-assets'
  and (storage.foldername(storage.objects.name))[1] = (select auth.uid())::text
  and (storage.foldername(storage.objects.name))[3] in ('references','backgrounds')
  and public.is_active_account()
  and exists (
    select 1 from public.projects p
    where p.id::text = (storage.foldername(storage.objects.name))[2]
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists studio_assets_owner_upload on storage.objects;
create policy studio_assets_owner_upload on storage.objects
for insert to authenticated
with check (
  bucket_id = 'studio-assets'
  and (storage.foldername(storage.objects.name))[1] = (select auth.uid())::text
  and (storage.foldername(storage.objects.name))[3] in ('references','backgrounds')
  and public.is_active_account()
  and exists (
    select 1 from public.projects p
    where p.id::text = (storage.foldername(storage.objects.name))[2]
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists studio_assets_owner_delete on storage.objects;
create policy studio_assets_owner_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'studio-assets'
  and (storage.foldername(storage.objects.name))[1] = (select auth.uid())::text
  and (storage.foldername(storage.objects.name))[3] in ('references','backgrounds')
  and public.is_active_account()
  and exists (
    select 1 from public.projects p
    where p.id::text = (storage.foldername(storage.objects.name))[2]
      and p.user_id = (select auth.uid())
  )
);
