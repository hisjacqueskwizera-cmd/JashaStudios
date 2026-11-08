-- Phase 9: durable metadata for transformation requests and worker execution.
-- The existing processing_jobs table remains server/worker-write only under RLS.

alter table public.processing_jobs
  add column if not exists idempotency_key text,
  add column if not exists input_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists transformation_settings jsonb not null default '{}'::jsonb,
  add column if not exists worker_id text,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists retry_after timestamptz,
  add column if not exists cancel_requested_at timestamptz;

alter table public.processing_jobs
  add constraint processing_jobs_idempotency_key_length
  check (idempotency_key is null or char_length(idempotency_key) between 8 and 128);

create unique index if not exists processing_jobs_user_idempotency_idx
  on public.processing_jobs(user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists processing_jobs_queue_idx
  on public.processing_jobs(created_at)
  where status = 'queued';

create index if not exists processing_jobs_expired_lease_idx
  on public.processing_jobs(lease_expires_at)
  where status in ('reserved', 'running');

comment on column public.processing_jobs.input_snapshot is
  'Server-generated snapshot of owned input asset IDs and immutable storage metadata; never store signed URLs or credentials.';
comment on column public.processing_jobs.transformation_settings is
  'Validated generation settings including reference treatment, output constraints and model/provider selection.';
comment on column public.processing_jobs.lease_expires_at is
  'Worker lease expiry used for safe recovery of abandoned processing jobs.';
comment on column public.processing_jobs.cancel_requested_at is
  'Timestamp at which an authorized owner requested cancellation; workers must check before publishing output.';
