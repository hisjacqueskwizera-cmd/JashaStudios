-- Phase 12: administrator audit-log reader.
create or replace function public.admin_list_audit_logs(p_limit integer default 50)
returns table(
  id uuid,
  actor_email text,
  action text,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_require_role();
  if p_limit not between 1 and 100 then
    raise exception 'Invalid limit' using errcode = '22023';
  end if;
  return query
  select l.id, u.email::text, l.action, l.target_type, l.target_id, l.metadata, l.created_at
  from public.admin_audit_logs l
  left join auth.users u on u.id = l.actor_user_id
  order by l.created_at desc
  limit p_limit;
end;
$$;
revoke all on function public.admin_list_audit_logs(integer) from public, anon;
grant execute on function public.admin_list_audit_logs(integer) to authenticated;
