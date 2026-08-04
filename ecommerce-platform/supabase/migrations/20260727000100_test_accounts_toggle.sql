-- =====================================================================
-- JOM HUB Marketplace — Test Accounts Toggle
-- Adds a site_settings row for admin to enable/disable test accounts
-- =====================================================================

-- Add test_accounts_enabled to site_settings
insert into public.site_settings (key, value)
values ('test_accounts', '{"enabled": false}'::jsonb)
on conflict (key) do nothing;

-- RPC: Toggle test accounts on/off
create or replace function public.toggle_test_accounts(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;

  insert into public.site_settings (key, value)
  values ('test_accounts', jsonb_build_object('enabled', p_enabled))
  on conflict (key) do update set value = jsonb_build_object('enabled', p_enabled);
end;
$$;

grant execute on function public.toggle_test_accounts(boolean) to authenticated;

-- RPC: Get test accounts status
create or replace function public.get_test_accounts_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_value jsonb;
begin
  select value into v_value
  from public.site_settings
  where key = 'test_accounts';

  return coalesce(v_value, '{"enabled": false}'::jsonb);
end;
$$;

grant execute on function public.get_test_accounts_status() to authenticated;

notify pgrst, 'reload schema';

