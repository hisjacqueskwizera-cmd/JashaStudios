-- Phase 7: short-lived paired-device upload credentials and mobile camera capture.
alter table public.paired_devices add column if not exists device_token_hash text;
create unique index if not exists paired_devices_active_token_hash_idx on public.paired_devices(device_token_hash) where device_token_hash is not null and revoked_at is null;
drop function if exists public.confirm_pairing_challenge(text,text);
create or replace function public.confirm_pairing_challenge(p_secret_hash text,p_device_label text,p_device_token_hash text)
returns table(connected_session_id uuid,connected_device_id uuid)
language plpgsql security definer set search_path=public as $$
declare v_session_id uuid;v_user_id uuid;v_device_id uuid;v_label text:=left(coalesce(nullif(trim(p_device_label),''),'Mobile camera'),80);
begin
 if p_secret_hash !~ '^[0-9a-f]{64}$' or p_device_token_hash !~ '^[0-9a-f]{64}$' then return; end if;
 update public.pairing_challenges pc set status='connected',consumed_at=now()
 where pc.secret_hash=p_secret_hash and pc.status='scanned' and pc.consumed_at is null and pc.expires_at>now()
 and exists(select 1 from public.studio_sessions ss where ss.id=pc.session_id and ss.user_id=pc.user_id and ss.status='waiting_for_phone' and ss.expires_at>now())
 returning pc.session_id,pc.user_id into v_session_id,v_user_id;
 if v_session_id is null then return; end if;
 insert into public.paired_devices(user_id,session_id,device_label,device_token_hash) values(v_user_id,v_session_id,v_label,p_device_token_hash) returning id into v_device_id;
 update public.studio_sessions set status='connected' where id=v_session_id and user_id=v_user_id;
 insert into public.session_events(user_id,session_id,event_type,payload) values(v_user_id,v_session_id,'device_connected',jsonb_build_object('device_label',v_label));
 return query select v_session_id,v_device_id;
end;$$;
create or replace function public.authorize_paired_device(p_device_token_hash text)
returns table(device_id uuid,user_id uuid,project_id uuid,session_id uuid)
language plpgsql security definer set search_path=public as $$
begin
 if p_device_token_hash !~ '^[0-9a-f]{64}$' then return; end if;
 return query select d.id,d.user_id,s.project_id,d.session_id
 from public.paired_devices d join public.studio_sessions s on s.id=d.session_id and s.user_id=d.user_id
 where d.device_token_hash=p_device_token_hash and d.revoked_at is null
 and s.status in ('connected','camera_ready','captured','uploaded') and s.expires_at>now() limit 1;
end;$$;
revoke all on function public.confirm_pairing_challenge(text,text,text) from public;
revoke all on function public.authorize_paired_device(text) from public;
grant execute on function public.confirm_pairing_challenge(text,text,text) to anon,authenticated;
grant execute on function public.authorize_paired_device(text) to anon,authenticated;
alter table public.captured_images enable row level security;
drop policy if exists captured_images_owner_select on public.captured_images;
create policy captured_images_owner_select on public.captured_images for select to authenticated using (
 user_id=auth.uid() and exists(select 1 from public.projects p where p.id=project_id and p.user_id=auth.uid())
);
comment on column public.paired_devices.device_token_hash is 'SHA-256 hash of a random device bearer credential issued only after explicit phone confirmation.';
