-- Temporary diagnostic helper: lets us read the live source of any function
-- in public, since this database was assembled from many loose, overlapping
-- SQL files applied by hand and the tracked migration history does not
-- reflect what actually ran. Used once to find which trigger version is
-- really live, then dropped in a follow-up migration.
create or replace function public.debug_get_function_def(p_name text)
returns text language plpgsql security definer set search_path=public as $$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = p_name
  limit 1;
  return v_def;
end;
$$;
grant execute on function public.debug_get_function_def(text) to authenticated;
notify pgrst,'reload schema';
