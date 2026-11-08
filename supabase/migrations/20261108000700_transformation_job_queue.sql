-- Phase 9: authenticated job creation and leased worker lifecycle.
-- Customer clients may enqueue/cancel only their own jobs. Worker RPCs are service_role only.

create or replace function public.enqueue_transformation_job(
  p_project_id uuid,
  p_reference_image_id uuid,
  p_captured_image_id uuid,
  p_idempotency_key text,
  p_style_notes text default ''
)
returns table(job_id uuid, job_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_reference public.reference_images%rowtype;
  v_capture public.captured_images%rowtype;
  v_project public.projects%rowtype;
  v_job public.processing_jobs%rowtype;
  v_snapshot jsonb;
  v_settings jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 128 then
    raise exception 'Invalid idempotency key' using errcode = '22023';
  end if;
  if char_length(coalesce(p_style_notes, '')) > 1000 then
    raise exception 'Style notes are too long' using errcode = '22023';
  end if;

  select * into v_project from public.projects
    where id = p_project_id and user_id = v_user_id and status <> 'archived';
  if not found then raise exception 'Project not found' using errcode = 'P0002'; end if;

  select * into v_reference from public.reference_images
    where id = p_reference_image_id and project_id = p_project_id and user_id = v_user_id;
  if not found then raise exception 'Reference image not found' using errcode = 'P0002'; end if;

  if v_project.selected_reference_image_id is distinct from p_reference_image_id then
    raise exception 'Select this reference in the project before generating' using errcode = '22023';
  end if;

  select * into v_capture from public.captured_images
    where id = p_captured_image_id and project_id = p_project_id and user_id = v_user_id;
  if not found then raise exception 'Captured image not found' using errcode = 'P0002'; end if;

  v_snapshot := jsonb_build_object(
    'reference_image', jsonb_build_object(
      'id', v_reference.id, 'storage_path', v_reference.storage_path,
      'mime_type', v_reference.mime_type, 'byte_size', v_reference.byte_size
    ),
    'captured_image', jsonb_build_object(
      'id', v_capture.id, 'storage_path', v_capture.storage_path,
      'mime_type', v_capture.mime_type, 'byte_size', v_capture.byte_size
    )
  );
  v_settings := jsonb_build_object('style_notes', trim(coalesce(p_style_notes, '')));

  insert into public.processing_jobs (
    user_id, project_id, reference_image_id, captured_image_id,
    status, stage, provider, progress, idempotency_key,
    input_snapshot, transformation_settings
  ) values (
    v_user_id, p_project_id, p_reference_image_id, p_captured_image_id,
    'queued', 'queued', 'openai', 0, p_idempotency_key,
    v_snapshot, v_settings
  )
  on conflict (user_id, idempotency_key) where idempotency_key is not null do nothing;

  select * into v_job from public.processing_jobs
    where user_id = v_user_id and idempotency_key = p_idempotency_key;
  if v_job.project_id <> p_project_id
    or v_job.reference_image_id <> p_reference_image_id
    or v_job.captured_image_id <> p_captured_image_id then
    raise exception 'Idempotency key was already used for different inputs' using errcode = '22023';
  end if;

  return query select v_job.id, v_job.status;
end;
$$;

create or replace function public.cancel_transformation_job(p_job_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_job public.processing_jobs%rowtype;
begin
  select * into v_job from public.processing_jobs
    where id = p_job_id and user_id = auth.uid()
    for update;
  if not found then return false; end if;

  if v_job.status = 'queued' then
    update public.processing_jobs set status = 'cancelled', stage = 'cancelled',
      completed_at = now(), progress = 0
    where id = p_job_id;
    return true;
  elsif v_job.status in ('reserved', 'running') then
    update public.processing_jobs set cancel_requested_at = coalesce(cancel_requested_at, now())
    where id = p_job_id;
    return true;
  end if;
  return v_job.status = 'cancelled';
end;
$$;

create or replace function public.claim_transformation_job(
  p_worker_id text,
  p_lease_seconds integer default 300,
  p_max_attempts integer default 3
)
returns table(
  id uuid, user_id uuid, project_id uuid, input_snapshot jsonb,
  transformation_settings jsonb, attempt_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare v_job_id uuid;
begin
  if p_worker_id is null or char_length(p_worker_id) not between 1 and 128
    or p_lease_seconds not between 60 and 900
    or p_max_attempts not between 1 and 10 then
    raise exception 'Invalid worker claim parameters' using errcode = '22023';
  end if;

  update public.processing_jobs
  set status = case
        when cancel_requested_at is not null then 'cancelled'
        when attempt_count >= p_max_attempts then 'failed'
        else 'queued' end,
      stage = case
        when cancel_requested_at is not null then 'cancelled'
        when attempt_count >= p_max_attempts then 'failed'
        else 'queued' end,
      worker_id = null, lease_expires_at = null,
      retry_after = case when cancel_requested_at is not null or attempt_count >= p_max_attempts then null else now() end,
      error_code = 'worker_lease_expired',
      error_message = 'A worker lease expired before the job completed.',
      completed_at = case when cancel_requested_at is not null or attempt_count >= p_max_attempts then now() else null end
  where status in ('reserved', 'running') and lease_expires_at < now();

  select j.id into v_job_id
  from public.processing_jobs j
  where j.status = 'queued' and j.cancel_requested_at is null
    and (j.retry_after is null or j.retry_after <= now())
  order by j.created_at asc
  for update skip locked
  limit 1;

  if v_job_id is null then return; end if;

  return query
  update public.processing_jobs j
  set status = 'running', stage = 'preparing', worker_id = p_worker_id,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      attempt_count = j.attempt_count + 1,
      started_at = coalesce(j.started_at, now()), progress = 5,
      error_code = null, error_message = null
  where j.id = v_job_id
  returning j.id, j.user_id, j.project_id, j.input_snapshot,
    j.transformation_settings, j.attempt_count;
end;
$$;

create or replace function public.complete_transformation_job(
  p_job_id uuid,
  p_worker_id text,
  p_storage_path text,
  p_byte_size bigint,
  p_width integer,
  p_height integer,
  p_provider text,
  p_model text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_job public.processing_jobs%rowtype;
begin
  select * into v_job from public.processing_jobs where id = p_job_id for update;
  if not found or v_job.worker_id is distinct from p_worker_id
    or v_job.status <> 'running' or v_job.lease_expires_at is null
    or v_job.lease_expires_at <= now() then return false; end if;

  if v_job.cancel_requested_at is not null then
    update public.processing_jobs set status = 'cancelled', stage = 'cancelled',
      completed_at = now(), worker_id = null, lease_expires_at = null
    where id = p_job_id;
    return false;
  end if;

  if p_storage_path is null or p_storage_path !~ (
    '^' || v_job.user_id::text || '/' || v_job.project_id::text || '/generated/' || v_job.id::text || '\.webp$'
  ) or p_byte_size <= 0 or p_width <= 0 or p_height <= 0 then
    raise exception 'Invalid generated output metadata' using errcode = '22023';
  end if;

  insert into public.generated_images (
    user_id, project_id, processing_job_id, storage_path,
    mime_type, byte_size, width, height
  ) values (
    v_job.user_id, v_job.project_id, v_job.id, p_storage_path,
    'image/webp', p_byte_size, p_width, p_height
  );

  update public.processing_jobs set status = 'succeeded', stage = 'completed',
    provider = p_provider, model = p_model, progress = 100,
    completed_at = now(), worker_id = null, lease_expires_at = null,
    retry_after = null
  where id = p_job_id;
  return true;
end;
$$;

create or replace function public.fail_transformation_job(
  p_job_id uuid,
  p_worker_id text,
  p_error_code text,
  p_retryable boolean default true,
  p_retry_seconds integer default 30,
  p_max_attempts integer default 3
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_job public.processing_jobs%rowtype; v_retry boolean;
begin
  if p_max_attempts not between 1 and 10 then
    raise exception 'Invalid retry limit' using errcode = '22023';
  end if;
  select * into v_job from public.processing_jobs where id = p_job_id for update;
  if not found or v_job.worker_id is distinct from p_worker_id
    or v_job.status <> 'running' or v_job.lease_expires_at is null
    or v_job.lease_expires_at <= now() then return false; end if;

  v_retry := coalesce(p_retryable, false)
    and v_job.attempt_count < p_max_attempts
    and v_job.cancel_requested_at is null;

  update public.processing_jobs set
    status = case when v_retry then 'queued' else
      case when cancel_requested_at is not null then 'cancelled' else 'failed' end end,
    stage = case when v_retry then 'queued' else
      case when cancel_requested_at is not null then 'cancelled' else 'failed' end end,
    retry_after = case when v_retry then now() + make_interval(secs => greatest(5, least(p_retry_seconds, 900))) else null end,
    error_code = left(coalesce(p_error_code, 'transformation_failed'), 80),
    error_message = 'The transformation could not be completed. Try again or retake the photo.',
    completed_at = case when v_retry then null else now() end,
    worker_id = null, lease_expires_at = null
  where id = p_job_id;
  return true;
end;
$$;

revoke all on function public.enqueue_transformation_job(uuid,uuid,uuid,text,text) from public, anon;
revoke all on function public.cancel_transformation_job(uuid) from public, anon;
grant execute on function public.enqueue_transformation_job(uuid,uuid,uuid,text,text) to authenticated;
grant execute on function public.cancel_transformation_job(uuid) to authenticated;

revoke all on function public.claim_transformation_job(text,integer,integer) from public, anon, authenticated;
revoke all on function public.complete_transformation_job(uuid,text,text,bigint,integer,integer,text,text) from public, anon, authenticated;
revoke all on function public.fail_transformation_job(uuid,text,text,boolean,integer,integer) from public, anon, authenticated;
grant execute on function public.claim_transformation_job(text,integer,integer) to service_role;
grant execute on function public.complete_transformation_job(uuid,text,text,bigint,integer,integer,text,text) to service_role;
grant execute on function public.fail_transformation_job(uuid,text,text,boolean,integer,integer) to service_role;

comment on function public.claim_transformation_job(text,integer,integer) is
  'Atomically claims one queued job with SKIP LOCKED and a bounded worker lease.';
comment on function public.complete_transformation_job(uuid,text,text,bigint,integer,integer,text,text) is
  'Publishes a validated generated image and marks its job succeeded in one transaction.';
