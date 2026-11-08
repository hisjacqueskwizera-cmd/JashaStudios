-- Phase 13: enforce suspended-account access boundaries at the database layer.
-- Existing JWTs must not retain access to private rows or paired-device APIs after suspension.

create or replace function public.is_active_account()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.account_status = 'active'
  );
$$;

revoke all on function public.is_active_account() from public, anon;
grant execute on function public.is_active_account() to authenticated;

-- Rebuild the standard owner-read policies with an active-account requirement.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'projects','reference_images','reference_analyses','studio_sessions',
    'pairing_challenges','paired_devices','session_events','captured_images',
    'image_analyses','processing_jobs','generated_images','subscriptions',
    'credit_ledger','payment_transactions','notifications'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_select', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = auth.uid() and public.is_active_account())',
      table_name || '_owner_select', table_name
    );
  end loop;
end;
$$;

drop policy if exists profiles_owner_select on public.profiles;
create policy profiles_owner_select on public.profiles
  for select to authenticated using (id = auth.uid() and public.is_active_account());

drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles
  for update to authenticated
  using (id = auth.uid() and public.is_active_account())
  with check (id = auth.uid() and public.is_active_account());

-- Additional asset policies are separate from the generic owner-read policies.
drop policy if exists reference_images_owner_insert on public.reference_images;
create policy reference_images_owner_insert on public.reference_images
  for insert to authenticated with check (
    user_id = auth.uid()
    and public.is_active_account()
    and exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );

drop policy if exists reference_images_owner_delete on public.reference_images;
create policy reference_images_owner_delete on public.reference_images
  for delete to authenticated using (
    user_id = auth.uid()
    and public.is_active_account()
    and exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );

drop policy if exists user_studio_backgrounds_owner_select on public.user_studio_backgrounds;
create policy user_studio_backgrounds_owner_select on public.user_studio_backgrounds
  for select to authenticated using (
    user_id = auth.uid() and public.is_active_account()
    and exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );

drop policy if exists user_studio_backgrounds_owner_insert on public.user_studio_backgrounds;
create policy user_studio_backgrounds_owner_insert on public.user_studio_backgrounds
  for insert to authenticated with check (
    user_id = auth.uid() and public.is_active_account()
    and exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );

drop policy if exists user_studio_backgrounds_owner_delete on public.user_studio_backgrounds;
create policy user_studio_backgrounds_owner_delete on public.user_studio_backgrounds
  for delete to authenticated using (
    user_id = auth.uid() and public.is_active_account()
    and exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );

-- Private storage reads/writes also stop working for suspended accounts.
drop policy if exists studio_assets_owner_read on storage.objects;
create policy studio_assets_owner_read on storage.objects
  for select to authenticated using (
    bucket_id = 'studio-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[3] in ('references','backgrounds')
    and public.is_active_account()
    and exists (select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[2] and p.user_id = auth.uid())
  );

drop policy if exists studio_assets_owner_upload on storage.objects;
create policy studio_assets_owner_upload on storage.objects
  for insert to authenticated with check (
    bucket_id = 'studio-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[3] in ('references','backgrounds')
    and public.is_active_account()
    and exists (select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[2] and p.user_id = auth.uid())
  );

drop policy if exists studio_assets_owner_delete on storage.objects;
create policy studio_assets_owner_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'studio-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[3] in ('references','backgrounds')
    and public.is_active_account()
    and exists (select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[2] and p.user_id = auth.uid())
  );

drop policy if exists studio_assets_generated_owner_read on storage.objects;
create policy studio_assets_generated_owner_read on storage.objects
  for select to authenticated using (
    bucket_id = 'studio-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[3] = 'generated'
    and public.is_active_account()
    and exists (select 1 from public.generated_images g
      where g.storage_path = name and g.user_id = auth.uid()
        and g.project_id::text = (storage.foldername(name))[2])
  );

-- New pairing challenges require an active account even though the RPC is SECURITY DEFINER.
create or replace function public.create_pairing_challenge(
  p_project_id uuid, p_secret_hash text, p_expires_at timestamptz
)
returns table (created_session_id uuid, created_challenge_id uuid, challenge_expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_challenge_id uuid;
begin
  if v_user_id is null or not public.is_active_account() then
    raise exception 'Active authenticated account required' using errcode = '42501';
  end if;
  if p_secret_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid pairing challenge hash' using errcode = '22023';
  end if;
  if p_expires_at <= now() + interval '1 minute' or p_expires_at > now() + interval '10 minutes' then
    raise exception 'Pairing challenge expiry must be between one and ten minutes' using errcode = '22023';
  end if;
  if not exists (select 1 from public.projects p
    where p.id = p_project_id and p.user_id = v_user_id and p.archived_at is null) then
    raise exception 'Project not found or unavailable' using errcode = '42501';
  end if;

  update public.pairing_challenges pc set status = 'revoked'
  where pc.user_id = v_user_id and pc.status in ('created','scanned')
    and exists (select 1 from public.studio_sessions ss
      where ss.id = pc.session_id and ss.project_id = p_project_id and ss.status = 'waiting_for_phone');
  update public.studio_sessions ss set status = 'ended', ended_at = now()
  where ss.user_id = v_user_id and ss.project_id = p_project_id and ss.status = 'waiting_for_phone';

  insert into public.studio_sessions(user_id, project_id, status, expires_at)
  values (v_user_id, p_project_id, 'waiting_for_phone', now() + interval '2 hours')
  returning id into v_session_id;
  insert into public.pairing_challenges(user_id, session_id, secret_hash, expires_at)
  values (v_user_id, v_session_id, p_secret_hash, p_expires_at)
  returning id into v_challenge_id;
  return query select v_session_id, v_challenge_id, p_expires_at;
end;
$$;

-- Previously issued phone credentials stop authorizing requests as soon as the owner is suspended.
create or replace function public.authorize_paired_device(p_device_token_hash text)
returns table(device_id uuid, user_id uuid, project_id uuid, session_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_device_token_hash !~ '^[0-9a-f]{64}$' then return; end if;
  return query
  select d.id, d.user_id, s.project_id, d.session_id
  from public.paired_devices d
  join public.studio_sessions s on s.id = d.session_id and s.user_id = d.user_id
  join public.profiles p on p.id = d.user_id and p.account_status = 'active'
  where d.device_token_hash = p_device_token_hash
    and d.revoked_at is null
    and s.status in ('connected','camera_ready','captured','uploaded')
    and s.expires_at > now()
  limit 1;
end;
$$;

revoke all on function public.create_pairing_challenge(uuid,text,timestamptz) from public, anon;
grant execute on function public.create_pairing_challenge(uuid,text,timestamptz) to authenticated;
revoke all on function public.authorize_paired_device(text) from public;
grant execute on function public.authorize_paired_device(text) to anon, authenticated;

comment on function public.is_active_account() is
  'Returns true only for the authenticated user with an active profile; used by RLS to revoke existing-session access after suspension.';
