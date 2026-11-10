-- Worker-only progress updates for the local image-processing pipeline.
create or replace function public.update_transformation_job_progress(
  p_job_id uuid,
  p_worker_id text,
  p_stage text,
  p_progress integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_worker_id is null or char_length(p_worker_id) not between 1 and 128
    or p_stage not in ('downloading', 'analyzing', 'segmenting', 'validating', 'uploading')
    or p_progress not between 1 and 99 then
    raise exception 'Invalid transformation progress update' using errcode = '22023';
  end if;

  update public.processing_jobs
  set stage = p_stage,
      progress = p_progress,
      updated_at = now()
  where id = p_job_id
    and worker_id = p_worker_id
    and status = 'running'
    and lease_expires_at is not null
    and lease_expires_at > now()
    and cancel_requested_at is null;

  return found;
end;
$$;

revoke all on function public.update_transformation_job_progress(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.update_transformation_job_progress(uuid, text, text, integer) to service_role;
