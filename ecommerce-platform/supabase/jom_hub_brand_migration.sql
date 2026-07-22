-- Update database-managed, user-visible brand copy without renaming any
-- technical identifiers, storage paths, tables, or historical records.
do $$
begin
  if to_regclass('public.site_settings') is not null then
    execute $sql$
      update public.site_settings
      set value = replace(replace(value::text, 'RM HUB', 'JOM HUB'), 'RM Hub', 'JOM HUB')::jsonb,
          updated_at = now()
      where value::text like '%RM HUB%' or value::text like '%RM Hub%'
    $sql$;
  end if;

  if to_regclass('public.system_policies') is not null then
    execute $sql$
      update public.system_policies
      set title = replace(replace(title, 'RM HUB', 'JOM HUB'), 'RM Hub', 'JOM HUB'),
          content = replace(replace(content, 'RM HUB', 'JOM HUB'), 'RM Hub', 'JOM HUB'),
          updated_at = now()
      where title like '%RM HUB%' or title like '%RM Hub%'
         or content like '%RM HUB%' or content like '%RM Hub%'
    $sql$;
  end if;
end $$;
