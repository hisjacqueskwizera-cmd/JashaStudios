-- Phase 6: secure, short-lived QR device pairing. Only SHA-256 hashes are stored.
create unique index if not exists paired_devices_one_active_per_session_idx
  on public.paired_devices(session_id) where revoked_at is null;

create or replace function public.create_pairing_challenge(
  p_project_id uuid, p_secret_hash text, p_expires_at timestamptz
)
returns table (created_session_id uuid, created_challenge_id uuid, challenge_expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_challenge_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_secret_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid pairing challenge hash' using errcode = '22023'; end if;
  if p_expires_at <= now() + interval '1 minute' or p_expires_at > now() + interval '10 minutes' then
    raise exception 'Pairing challenge expiry must be between one and ten minutes' using errcode = '22023';
  end if;
  if not exists (select 1 from public.projects p where p.id=p_project_id and p.user_id=v_user_id and p.archived_at is null) then
    raise exception 'Project not found or unavailable' using errcode = '42501';
  end if;

  update public.pairing_challenges pc set status='revoked'
  where pc.user_id=v_user_id and pc.status in ('created','scanned')
    and exists (select 1 from public.studio_sessions ss where ss.id=pc.session_id and ss.project_id=p_project_id and ss.status='waiting_for_phone');
  update public.studio_sessions ss set status='ended', ended_at=now()
  where ss.user_id=v_user_id and ss.project_id=p_project_id and ss.status='waiting_for_phone';

  insert into public.studio_sessions(user_id,project_id,status,expires_at)
  values(v_user_id,p_project_id,'waiting_for_phone',now()+interval '2 hours') returning id into v_session_id;
  insert into public.pairing_challenges(user_id,session_id,secret_hash,expires_at)
  values(v_user_id,v_session_id,p_secret_hash,p_expires_at) returning id into v_challenge_id;
  return query select v_session_id,v_challenge_id,p_expires_at;
end;
$$;

create or replace function public.claim_pairing_challenge(p_secret_hash text)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_claimed boolean := false;
begin
  if p_secret_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  update public.pairing_challenges pc set status='expired'
  where pc.secret_hash=p_secret_hash and pc.status in ('created','scanned') and pc.expires_at<=now();
  update public.pairing_challenges pc set status='scanned',attempts=pc.attempts+1
  where pc.secret_hash=p_secret_hash and pc.status='created' and pc.expires_at>now() and pc.attempts<5
    and exists(select 1 from public.studio_sessions ss where ss.id=pc.session_id and ss.status='waiting_for_phone' and ss.expires_at>now());
  v_claimed := found;
  if v_claimed then return true; end if;
  return exists(
    select 1 from public.pairing_challenges pc join public.studio_sessions ss on ss.id=pc.session_id
    where pc.secret_hash=p_secret_hash and pc.status='scanned' and pc.expires_at>now()
      and ss.status='waiting_for_phone' and ss.expires_at>now()
  );
end;
$$;

create or replace function public.confirm_pairing_challenge(p_secret_hash text,p_device_label text default 'Mobile camera')
returns table(connected_session_id uuid,connected_device_id uuid)
language plpgsql security definer set search_path=public as $$
declare
  v_session_id uuid;
  v_user_id uuid;
  v_device_id uuid;
  v_label text := left(coalesce(nullif(trim(p_device_label),''),'Mobile camera'),80);
begin
  if p_secret_hash !~ '^[0-9a-f]{64}$' then return; end if;
  update public.pairing_challenges pc set status='connected',consumed_at=now()
  where pc.secret_hash=p_secret_hash and pc.status='scanned' and pc.consumed_at is null and pc.expires_at>now()
    and exists(select 1 from public.studio_sessions ss where ss.id=pc.session_id and ss.user_id=pc.user_id and ss.status='waiting_for_phone' and ss.expires_at>now())
  returning pc.session_id,pc.user_id into v_session_id,v_user_id;
  if v_session_id is null then return; end if;

  insert into public.paired_devices(user_id,session_id,device_label)
  values(v_user_id,v_session_id,v_label) returning id into v_device_id;
  update public.studio_sessions set status='connected' where id=v_session_id and user_id=v_user_id;
  insert into public.session_events(user_id,session_id,event_type,payload)
  values(v_user_id,v_session_id,'device_connected',jsonb_build_object('device_label',v_label));
  return query select v_session_id,v_device_id;
end;
$$;

create or replace function public.revoke_pairing_challenge(p_challenge_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select pc.session_id into v_session_id from public.pairing_challenges pc
  where pc.id=p_challenge_id and pc.user_id=v_user_id and pc.status in ('created','scanned','connected') for update;
  if v_session_id is null then return false; end if;
  update public.pairing_challenges set status='revoked' where id=p_challenge_id and user_id=v_user_id;
  update public.paired_devices set revoked_at=now() where session_id=v_session_id and user_id=v_user_id and revoked_at is null;
  update public.studio_sessions set status='ended',ended_at=now()
  where id=v_session_id and user_id=v_user_id and status not in ('ended','completed','failed');
  insert into public.session_events(user_id,session_id,event_type) values(v_user_id,v_session_id,'device_disconnected');
  return true;
end;
$$;

revoke all on function public.create_pairing_challenge(uuid,text,timestamptz) from public;
revoke all on function public.claim_pairing_challenge(text) from public;
revoke all on function public.confirm_pairing_challenge(text,text) from public;
revoke all on function public.revoke_pairing_challenge(uuid) from public;
grant execute on function public.create_pairing_challenge(uuid,text,timestamptz) to authenticated;
grant execute on function public.claim_pairing_challenge(text) to anon,authenticated;
grant execute on function public.confirm_pairing_challenge(text,text) to anon,authenticated;
grant execute on function public.revoke_pairing_challenge(uuid) to authenticated;
