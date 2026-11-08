-- Phase 12: secure admin console and audited management RPCs.
-- Privileges are read only from Supabase app_metadata.role, never user_metadata.

alter table public.profiles add column if not exists email text;
update public.profiles p set email = u.email
from auth.users u where u.id = p.id and p.email is distinct from u.email;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, email)
  values(new.id, coalesce(new.raw_user_meta_data ->> 'full_name',''), new.email)
  on conflict(id) do update set email = excluded.email;
  return new;
end;
$$;

create or replace function public.admin_require_role()
returns void language plpgsql stable security invoker set search_path = public
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') <> 'admin' then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.admin_require_role() from public, anon;
grant execute on function public.admin_require_role() to authenticated;

-- Repair the Phase 11 balance function's dollar-quoted body before it is used.
create or replace function public.get_credit_balance()
returns bigint language sql stable security invoker set search_path = public
as $$
  select coalesce(sum(amount),0)::bigint
  from public.credit_ledger where user_id = auth.uid();
$$;
revoke all on function public.get_credit_balance() from public, anon;
grant execute on function public.get_credit_balance() to authenticated;

drop policy if exists profiles_admin_select on public.profiles;
create policy profiles_admin_select on public.profiles for select to authenticated
using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin');

drop policy if exists billing_products_admin_read on public.billing_products;
create policy billing_products_admin_read on public.billing_products for select to authenticated
using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin');

create or replace function public.admin_dashboard_summary()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.admin_require_role();
  return jsonb_build_object(
    'total_users',(select count(*) from auth.users),
    'active_users',(select count(*) from public.profiles where account_status='active'),
    'suspended_users',(select count(*) from public.profiles where account_status='suspended'),
    'total_projects',(select count(*) from public.projects),
    'total_captures',(select count(*) from public.captured_images),
    'total_generated_images',(select count(*) from public.generated_images),
    'jobs_queued',(select count(*) from public.processing_jobs where status='queued'),
    'jobs_running',(select count(*) from public.processing_jobs where status in ('reserved','running')),
    'jobs_failed',(select count(*) from public.processing_jobs where status='failed'),
    'successful_payments',(select count(*) from public.payment_transactions where status='succeeded'),
    'pending_payments',(select count(*) from public.payment_transactions where status='pending'),
    'revenue_rwf',(select coalesce(sum(amount_minor),0) from public.payment_transactions where status='succeeded' and currency='RWF')
  );
end;
$$;

create or replace function public.admin_list_users(p_query text default '', p_limit integer default 50, p_offset integer default 0)
returns table(user_id uuid,email text,full_name text,account_status text,created_at timestamptz,projects_count bigint,credit_balance bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.admin_require_role();
  if p_limit not between 1 and 100 or p_offset < 0 then
    raise exception 'Invalid pagination' using errcode='22023';
  end if;
  return query
  select u.id,u.email::text,coalesce(p.full_name,''),coalesce(p.account_status,'active'),u.created_at,
    (select count(*) from public.projects pr where pr.user_id=u.id),
    (select coalesce(sum(cl.amount),0)::bigint from public.credit_ledger cl where cl.user_id=u.id)
  from auth.users u left join public.profiles p on p.id=u.id
  where coalesce(p_query,'')='' or u.email ilike '%'||left(p_query,120)||'%'
    or coalesce(p.full_name,'') ilike '%'||left(p_query,120)||'%'
  order by u.created_at desc limit p_limit offset p_offset;
end;
$$;

create or replace function public.admin_set_user_status(p_user_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_actor uuid := auth.uid();
begin
  perform public.admin_require_role();
  if p_status not in ('active','suspended') then
    raise exception 'Unsupported account status' using errcode='22023';
  end if;
  if p_user_id=v_actor then
    raise exception 'Administrators cannot suspend their own account' using errcode='22023';
  end if;
  update public.profiles set account_status=p_status where id=p_user_id;
  if not found then return false; end if;
  update auth.users set banned_until=case
    when p_status='suspended' then now()+interval '100 years' else null end
  where id=p_user_id;
  insert into public.admin_audit_logs(actor_user_id,action,target_type,target_id,metadata)
  values(v_actor,'user.status_changed','user',p_user_id,jsonb_build_object('status',p_status));
  return true;
end;
$$;

create or replace function public.admin_list_billing_products()
returns setof public.billing_products language plpgsql stable security definer set search_path=public
as $$
begin
  perform public.admin_require_role();
  return query select * from public.billing_products order by sort_order,code;
end;
$$;

create or replace function public.admin_update_billing_product(p_code text,p_amount_rwf bigint,p_credits integer,p_is_active boolean)
returns boolean language plpgsql security definer set search_path=public
as $$
declare v_actor uuid:=auth.uid(); v_product public.billing_products%rowtype;
begin
  perform public.admin_require_role();
  if p_amount_rwf is null or p_amount_rwf<1 or (p_credits is not null and p_credits<1) then
    raise exception 'Price and credit allowance must be positive values' using errcode='22023';
  end if;
  select * into v_product from public.billing_products where code=p_code for update;
  if not found then return false; end if;
  update public.billing_products set amount_minor=p_amount_rwf,credits_per_purchase=p_credits,
    is_active=p_is_active,updated_at=now(),
    metadata=metadata||jsonb_build_object('last_admin_update_at',now())
  where code=p_code;
  insert into public.admin_audit_logs(actor_user_id,action,target_type,metadata)
  values(v_actor,'billing_product.updated','billing_product',jsonb_build_object(
    'code',p_code,'old_amount_rwf',v_product.amount_minor,'new_amount_rwf',p_amount_rwf,
    'old_credits',v_product.credits_per_purchase,'new_credits',p_credits,'is_active',p_is_active));
  return true;
end;
$$;

create or replace function public.admin_adjust_user_credits(p_user_id uuid,p_amount integer,p_reason text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_actor uuid:=auth.uid(); v_balance bigint; v_reference text:='admin-adjustment:'||gen_random_uuid()::text; v_entry uuid;
begin
  perform public.admin_require_role();
  if p_amount is null or p_amount=0 or abs(p_amount::bigint)>10000
    or char_length(trim(coalesce(p_reason,''))) not between 5 and 300 then
    raise exception 'Invalid credit adjustment' using errcode='22023';
  end if;
  if not exists(select 1 from auth.users where id=p_user_id) then
    raise exception 'User not found' using errcode='P0002';
  end if;
  select coalesce(sum(amount),0)::bigint into v_balance from public.credit_ledger where user_id=p_user_id;
  if v_balance+p_amount<0 then
    raise exception 'Credit balance cannot become negative' using errcode='22023';
  end if;
  insert into public.credit_ledger(user_id,transaction_type,amount,reference,description)
  values(p_user_id,'admin_adjustment',p_amount,v_reference,trim(p_reason)) returning id into v_entry;
  insert into public.admin_audit_logs(actor_user_id,action,target_type,target_id,metadata)
  values(v_actor,'credits.adjusted','user',p_user_id,jsonb_build_object('amount',p_amount,'reason',trim(p_reason),'ledger_entry_id',v_entry));
  return v_entry;
end;
$$;

create or replace function public.admin_list_payments(p_limit integer default 50)
returns table(payment_id uuid,user_email text,product_code text,provider text,amount_rwf bigint,currency text,status text,created_at timestamptz,verified_at timestamptz)
language plpgsql stable security definer set search_path=public
as $$
begin
  perform public.admin_require_role();
  if p_limit not between 1 and 100 then raise exception 'Invalid limit' using errcode='22023'; end if;
  return query select pt.id,u.email::text,pt.product_code,pt.provider,pt.amount_minor,pt.currency::text,pt.status,pt.created_at,pt.verified_at
  from public.payment_transactions pt join auth.users u on u.id=pt.user_id order by pt.created_at desc limit p_limit;
end;
$$;

create or replace function public.admin_list_jobs(p_limit integer default 50)
returns table(job_id uuid,user_email text,project_id uuid,status text,stage text,provider text,model text,attempt_count integer,error_code text,created_at timestamptz,completed_at timestamptz)
language plpgsql stable security definer set search_path=public
as $$
begin
  perform public.admin_require_role();
  if p_limit not between 1 and 100 then raise exception 'Invalid limit' using errcode='22023'; end if;
  return query select j.id,u.email::text,j.project_id,j.status,j.stage,j.provider,j.model,j.attempt_count,j.error_code,j.created_at,j.completed_at
  from public.processing_jobs j join auth.users u on u.id=j.user_id order by j.created_at desc limit p_limit;
end;
$$;

revoke all on function public.admin_dashboard_summary() from public,anon;
revoke all on function public.admin_list_users(text,integer,integer) from public,anon;
revoke all on function public.admin_set_user_status(uuid,text) from public,anon;
revoke all on function public.admin_list_billing_products() from public,anon;
revoke all on function public.admin_update_billing_product(text,bigint,integer,boolean) from public,anon;
revoke all on function public.admin_adjust_user_credits(uuid,integer,text) from public,anon;
revoke all on function public.admin_list_payments(integer) from public,anon;
revoke all on function public.admin_list_jobs(integer) from public,anon;
grant execute on function public.admin_dashboard_summary() to authenticated;
grant execute on function public.admin_list_users(text,integer,integer) to authenticated;
grant execute on function public.admin_set_user_status(uuid,text) to authenticated;
grant execute on function public.admin_list_billing_products() to authenticated;
grant execute on function public.admin_update_billing_product(text,bigint,integer,boolean) to authenticated;
grant execute on function public.admin_adjust_user_credits(uuid,integer,text) to authenticated;
grant execute on function public.admin_list_payments(integer) to authenticated;
grant execute on function public.admin_list_jobs(integer) to authenticated;
