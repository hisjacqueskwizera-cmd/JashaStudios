-- Enable Supabase Realtime for the desktop/mobile photography workflow.
-- Realtime still applies table privileges and row-level security to subscribers.
do $$
declare
  v_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime publication is not available; realtime subscriptions remain disabled until it is created.';
    return;
  end if;

  foreach v_table in array array[
    'captured_images',
    'studio_sessions',
    'processing_jobs',
    'generated_images'
  ] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;
