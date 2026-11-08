-- Jasha Studios foundation schema.
-- Apply with Supabase CLI: supabase db push (after linking a Supabase project).
-- All private records are owner-scoped. Financial/audit writes are server-only.

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_path text,
  account_status text not null default 'active'
    check (account_status in ('active', 'suspended', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  category text,
  status text not null default 'draft'
    check (status in ('draft','preparing','ready_for_capture','capturing','processing','completed','failed','archived')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.studio_backgrounds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null,
  preview_path text not null,
  original_path text not null,
  lighting_metadata jsonb not null default '{}'::jsonb,
  style_metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reference_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  background_id uuid references public.studio_backgrounds(id) on delete set null,
  storage_path text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  byte_size bigint not null check (byte_size > 0),
  width integer,
  height integer,
  created_at timestamptz not null default now()
);

create table if not exists public.reference_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reference_image_id uuid not null references public.reference_images(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  analysis jsonb,
  model_version text,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.studio_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'created'
    check (status in ('created','waiting_for_phone','connected','camera_ready','captured','uploaded','processing','completed','ended','failed')),
  expires_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pairing_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.studio_sessions(id) on delete cascade,
  secret_hash text not null unique,
  status text not null default 'created'
    check (status in ('created','scanned','confirmed','connected','expired','revoked','failed')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.paired_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.studio_sessions(id) on delete cascade,
  device_label text,
  connected_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.session_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.studio_sessions(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.captured_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  session_id uuid references public.studio_sessions(id) on delete set null,
  storage_path text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  byte_size bigint not null check (byte_size > 0),
  width integer,
  height integer,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.image_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  captured_image_id uuid not null references public.captured_images(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  analysis jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  reference_image_id uuid not null references public.reference_images(id) on delete restrict,
  captured_image_id uuid not null references public.captured_images(id) on delete restrict,
  status text not null default 'queued'
    check (status in ('queued','reserved','running','succeeded','failed','cancelled')),
  stage text,
  provider text,
  model text,
  progress integer check (progress between 0 and 100),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  error_code text,
  error_message text,
  cost_estimate numeric(12,4),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generated_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  processing_job_id uuid not null references public.processing_jobs(id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0),
  width integer,
  height integer,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null,
  status text not null check (status in ('pending','active','past_due','cancelled','expired')),
  provider text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_type text not null,
  amount integer not null check (amount <> 0),
  reference text,
  description text,
  processing_job_id uuid references public.processing_jobs(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_reference text,
  idempotency_key text not null unique,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'RWF',
  status text not null check (status in ('pending','succeeded','failed','refunded')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists projects_user_updated_idx on public.projects(user_id, updated_at desc);
create index if not exists reference_images_project_idx on public.reference_images(project_id, created_at desc);
create index if not exists reference_analyses_reference_idx on public.reference_analyses(reference_image_id, created_at desc);
create index if not exists sessions_user_status_idx on public.studio_sessions(user_id, status);
create index if not exists pairing_challenges_expiry_idx on public.pairing_challenges(expires_at) where status = 'created';
create index if not exists session_events_session_idx on public.session_events(session_id, created_at);
create index if not exists captures_project_idx on public.captured_images(project_id, created_at desc);
create index if not exists jobs_user_status_idx on public.processing_jobs(user_id, status, created_at desc);
create index if not exists generated_project_idx on public.generated_images(project_id, created_at desc);
create index if not exists subscriptions_user_status_idx on public.subscriptions(user_id, status);
create index if not exists ledger_user_created_idx on public.credit_ledger(user_id, created_at desc);
create index if not exists payments_user_created_idx on public.payment_transactions(user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;

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
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = auth.uid())',
      table_name || '_owner_select', table_name
    );
  end loop;
end $$;

alter table public.profiles enable row level security;
create policy profiles_owner_select on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_owner_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Users may edit only their display name and avatar, never account status.
revoke all on public.profiles from anon;
revoke insert, update on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, avatar_path) on public.profiles to authenticated;

alter table public.studio_backgrounds enable row level security;
create policy backgrounds_active_read on public.studio_backgrounds
  for select to authenticated using (is_active = true);
create policy backgrounds_admin_manage on public.studio_backgrounds
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

alter table public.admin_audit_logs enable row level security;
create policy audit_admin_read on public.admin_audit_logs
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Client-side writes are intentionally absent for credit_ledger,
-- payment_transactions, session_events, pairing_challenges and processing_jobs.
-- Trusted server/worker code must perform those operations after authorization.

do $$
declare
  table_name text;
begin
  foreach table_name in array array['profiles','projects','studio_sessions','processing_jobs','subscriptions','payment_transactions'] loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_set_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      table_name || '_set_updated_at', table_name
    );
  end loop;
end $$;
