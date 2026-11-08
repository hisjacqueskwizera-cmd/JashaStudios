-- Phase 11: billing catalog, immutable credits and verified-payment settlement.
-- Amounts are stored as whole RWF units (RWF has no fractional subunit in this product).
-- Payment-provider integration is intentionally unconfigured; this migration does not charge customers.

create table if not exists public.billing_products (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{2,39}$'),
  name text not null,
  description text not null default '',
  product_type text not null check (product_type in ('photo_credit', 'subscription')),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'RWF' check (currency = 'RWF'),
  billing_interval text not null check (billing_interval in ('one_time', 'month')),
  credits_per_purchase integer check (credits_per_purchase is null or credits_per_purchase > 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.billing_products
  (code, name, description, product_type, amount_minor, currency, billing_interval, credits_per_purchase, sort_order, metadata)
values
  ('single_photo', 'Single photograph', 'One AI photo transformation credit.', 'photo_credit', 3000, 'RWF', 'one_time', 1, 1,
    '{"seeded":true,"note":"Provider checkout remains disabled until a payment gateway is configured."}'::jsonb),
  ('standard', 'Standard', 'Monthly studio subscription. Credit allowance is configurable and intentionally unset.', 'subscription', 16000, 'RWF', 'month', null, 2,
    '{"seeded":true,"monthly_credits_configured":false}'::jsonb),
  ('pro', 'Pro', 'Monthly studio subscription. Credit allowance is configurable and intentionally unset.', 'subscription', 28000, 'RWF', 'month', null, 3,
    '{"seeded":true,"monthly_credits_configured":false}'::jsonb)
-- Preserve administrator-edited prices and allowances if this seed is replayed.
on conflict (code) do nothing;

alter table public.payment_transactions
  add column if not exists product_code text references public.billing_products(code),
  add column if not exists provider_event_id text,
  add column if not exists verified_at timestamptz,
  add column if not exists failure_code text;

alter table public.subscriptions
  add column if not exists billing_product_code text references public.billing_products(code),
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists cancelled_at timestamptz;

create unique index if not exists payment_transactions_provider_event_unique
  on public.payment_transactions(provider, provider_event_id)
  where provider_event_id is not null;

create unique index if not exists credit_ledger_reference_unique
  on public.credit_ledger(user_id, reference)
  where reference is not null;

create index if not exists billing_products_active_sort_idx
  on public.billing_products(is_active, sort_order);

create index if not exists subscriptions_user_period_idx
  on public.subscriptions(user_id, current_period_end desc);

-- Balance is calculated over the complete immutable ledger, not just the recent activity page.
create or replace function public.get_credit_balance()
returns bigint
language sql
stable
security invoker
set search_path = public
as $
  select coalesce(sum(amount), 0)::bigint
  from public.credit_ledger
  where user_id = auth.uid();
$;

revoke all on function public.get_credit_balance() from public, anon;
grant execute on function public.get_credit_balance() to authenticated;

alter table public.billing_products enable row level security;
drop policy if exists billing_products_active_read on public.billing_products;
create policy billing_products_active_read on public.billing_products
  for select to authenticated using (is_active = true);
revoke all on public.billing_products from anon;
grant select on public.billing_products to authenticated;

-- Credit history is append-only. Corrections must be compensating ledger entries.
create or replace function public.prevent_credit_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  -- Permit privileged account-erasure cascades; normal app roles cannot mutate history.
  if tg_op = 'DELETE'
    and current_setting('request.jwt.claim.role', true) = 'service_role' then
    return old;
  end if;
  raise exception 'Credit ledger entries are immutable; create a compensating entry instead.'
    using errcode = '55000';
end;
$$;

drop trigger if exists credit_ledger_immutable on public.credit_ledger;
create trigger credit_ledger_immutable
  before update or delete on public.credit_ledger
  for each row execute function public.prevent_credit_ledger_mutation();

-- This RPC must only be called after the payment provider's signature and transaction
-- status have been verified by trusted server code. It checks amount/currency and is idempotent.
create or replace function public.apply_verified_payment(
  p_payment_id uuid,
  p_provider_event_id text,
  p_provider_reference text,
  p_verified_amount bigint,
  p_verified_currency text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payment_transactions%rowtype;
  v_product public.billing_products%rowtype;
begin
  if p_provider_event_id is null or char_length(p_provider_event_id) not between 1 and 200 then
    raise exception 'Invalid provider event identifier' using errcode = '22023';
  end if;

  select * into v_payment from public.payment_transactions
    where id = p_payment_id for update;
  if not found then raise exception 'Payment not found' using errcode = 'P0002'; end if;

  if v_payment.status = 'succeeded' then
    return true;
  end if;
  if v_payment.status <> 'pending' then
    raise exception 'Payment is not pending' using errcode = '22023';
  end if;

  select * into v_product from public.billing_products
    where code = v_payment.product_code and is_active = true;
  if not found then raise exception 'Billing product is unavailable' using errcode = '22023'; end if;

  if v_payment.amount_minor <> p_verified_amount
    or v_payment.currency <> upper(p_verified_currency) then
    raise exception 'Verified payment amount or currency does not match the order' using errcode = '22023';
  end if;

  update public.payment_transactions set
    status = 'succeeded',
    provider_event_id = p_provider_event_id,
    provider_reference = coalesce(p_provider_reference, provider_reference),
    verified_at = now(),
    updated_at = now()
  where id = p_payment_id;

  if v_product.credits_per_purchase is not null then
    insert into public.credit_ledger (
      user_id, transaction_type, amount, reference, description
    ) values (
      v_payment.user_id, 'purchase', v_product.credits_per_purchase,
      'payment:' || v_payment.id::text,
      v_product.name || ' purchase'
    ) on conflict (user_id, reference) where reference is not null do nothing;
  end if;

  if v_product.product_type = 'subscription' then
    insert into public.subscriptions (
      user_id, plan_code, billing_product_code, status, provider,
      current_period_start, current_period_end
    ) values (
      v_payment.user_id, v_product.code, v_product.code, 'active',
      v_payment.provider, now(), now() + interval '1 month'
    );
  end if;

  return true;
end;
$$;

revoke all on function public.apply_verified_payment(uuid,text,text,bigint,text) from public, anon, authenticated;
grant execute on function public.apply_verified_payment(uuid,text,text,bigint,text) to service_role;

comment on table public.billing_products is
  'Seeded RWF catalog. Prices are editable by trusted administration; monthly credit allowances remain unset until approved.';
comment on function public.apply_verified_payment(uuid,text,text,bigint,text) is
  'Settles a pending payment only after trusted server-side provider verification; grants credits and activates an initial subscription period atomically.';
