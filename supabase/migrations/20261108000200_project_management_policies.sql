-- Owner-only write policies for project management.
drop policy if exists projects_owner_insert on public.projects;
create policy projects_owner_insert on public.projects
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists projects_owner_update on public.projects;
create policy projects_owner_update on public.projects
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists projects_owner_delete on public.projects;
create policy projects_owner_delete on public.projects
  for delete to authenticated using (user_id = auth.uid());
