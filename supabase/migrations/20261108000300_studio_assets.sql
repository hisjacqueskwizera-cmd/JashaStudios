-- Phase 4: private project assets and the studio preset catalog.
-- Apply after 20261108000200_project_management_policies.sql.

create table if not exists public.user_studio_backgrounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 15728640),
  width integer check (width is null or width between 1 and 12000),
  height integer check (height is null or height between 1 and 12000),
  created_at timestamptz not null default now()
);

alter table public.projects
  add column if not exists selected_reference_image_id uuid
    references public.reference_images(id) on delete set null,
  add column if not exists selected_user_background_id uuid
    references public.user_studio_backgrounds(id) on delete set null,
  add column if not exists selected_studio_background_id uuid
    references public.studio_backgrounds(id) on delete set null;

create index if not exists user_studio_backgrounds_project_idx
  on public.user_studio_backgrounds(project_id, created_at desc);

alter table public.reference_images enable row level security;
drop policy if exists reference_images_owner_insert on public.reference_images;
create policy reference_images_owner_insert on public.reference_images
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );
drop policy if exists reference_images_owner_delete on public.reference_images;
create policy reference_images_owner_delete on public.reference_images
  for delete to authenticated using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

alter table public.user_studio_backgrounds enable row level security;
drop policy if exists user_studio_backgrounds_owner_select on public.user_studio_backgrounds;
create policy user_studio_backgrounds_owner_select on public.user_studio_backgrounds
  for select to authenticated using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );
drop policy if exists user_studio_backgrounds_owner_insert on public.user_studio_backgrounds;
create policy user_studio_backgrounds_owner_insert on public.user_studio_backgrounds
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );
drop policy if exists user_studio_backgrounds_owner_delete on public.user_studio_backgrounds;
create policy user_studio_backgrounds_owner_delete on public.user_studio_backgrounds
  for delete to authenticated using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

-- Private customer uploads: each object is scoped to owner/project/type.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'studio-assets',
  'studio-assets',
  false,
  15728640,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists studio_assets_owner_read on storage.objects;
create policy studio_assets_owner_read on storage.objects
  for select to authenticated using (
    bucket_id = 'studio-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[3] in ('references','backgrounds')
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[2]
        and p.user_id = auth.uid()
    )
  );

drop policy if exists studio_assets_owner_upload on storage.objects;
create policy studio_assets_owner_upload on storage.objects
  for insert to authenticated with check (
    bucket_id = 'studio-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[3] in ('references','backgrounds')
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[2]
        and p.user_id = auth.uid()
    )
  );

drop policy if exists studio_assets_owner_delete on storage.objects;
create policy studio_assets_owner_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'studio-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[3] in ('references','backgrounds')
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[2]
        and p.user_id = auth.uid()
    )
  );

-- Preset images are public to read but only admins can manage their objects.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'studio-presets',
  'studio-presets',
  true,
  15728640,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists studio_presets_public_read on storage.objects;
create policy studio_presets_public_read on storage.objects
  for select to public using (bucket_id = 'studio-presets');

drop policy if exists studio_presets_admin_insert on storage.objects;
create policy studio_presets_admin_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'studio-presets'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
drop policy if exists studio_presets_admin_update on storage.objects;
create policy studio_presets_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'studio-presets' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check (bucket_id = 'studio-presets' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists studio_presets_admin_delete on storage.objects;
create policy studio_presets_admin_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'studio-presets'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- A selected reference/background must be cleared when its asset is deleted.
comment on column public.projects.selected_reference_image_id is
  'Reference image selected for the project; validated against project ownership by application actions.';
comment on column public.projects.selected_user_background_id is
  'Customer-uploaded background selected for this project.';
comment on column public.projects.selected_studio_background_id is
  'Admin-published catalog background selected for this project.';
