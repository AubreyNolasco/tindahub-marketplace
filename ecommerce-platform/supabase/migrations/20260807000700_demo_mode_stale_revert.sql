-- Root-cause for TASK6.md's recurring "admin demo account stuck as
-- reseller/merchant" incident (happened 3x, always fixed by hand):
-- switch_role_for_demo()/switch_back_to_admin() are each a single,
-- separately-invoked RPC, and DemoModeBanner.jsx already renders globally
-- (mounted in App.jsx above <Routes>, driven off profile.previous_role, not
-- off the current route) so "Back to Admin" already follows the user to
-- every page -- confirmed there is no in-app path that strands the account
-- without a visible way back. The actual gap is outside the app entirely:
-- closing the tab, a browser crash, losing network right as "Back to Admin"
-- is clicked (the RPC call fails, the banner is still there, but nothing
-- forces the user to notice and retry), or simply forgetting -- none of
-- which the frontend can ever guard against. There has never been a time
-- bound on how long an account can sit with previous_role set, so once any
-- of those happens the account stays stuck until someone notices by hand.
-- Confirmed via a fresh grep of every migration mentioning previous_role
-- (the three demo-switch files) that no such safeguard exists today.
--
-- Fix: give demo mode a real start timestamp, and fold a stale-demo revert
-- into the existing hourly run_operational_maintenance() job (same pattern
-- already used to extend it with log retention in
-- 20260728000300_storage_and_log_retention.sql) rather than adding a
-- second cron job for one more housekeeping check. Any account still
-- sitting with previous_role set more than 1 hour after switching gets
-- auto-restored -- the exact same role = previous_role, previous_role =
-- null restoration switch_back_to_admin() itself performs, just
-- server-triggered instead of waiting for a click that may never come.

alter table public.profiles add column if not exists demo_mode_started_at timestamptz;

-- Unchanged from 20260729000800 except stamping demo_mode_started_at.
create or replace function public.switch_role_for_demo(p_target_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_target_role not in ('reseller', 'merchant') then raise exception 'INVALID_TARGET_ROLE'; end if;

  perform set_config('app.demo_role_switch', 'true', true);

  insert into public.wallets (owner_id, balance)
  values (v_uid, 10000000)
  on conflict (owner_id) do update set balance = greatest(public.wallets.balance, 10000000);

  if p_target_role = 'merchant' then
    insert into public.merchant_profiles (
      id, business_name, business_description, business_address, status,
      subscription_active, subscription_expires_at,
      business_permit_status, business_permit_notes, business_permit_reviewed_at
    ) values (
      v_uid, 'Admin Demo Merchant', 'Internal admin demo merchant account',
      'Internal demo address - not for real deliveries', 'approved', true,
      now() + interval '100 years', 'approved',
      'Admin demo account exemption', now()
    ) on conflict (id) do update set
      status = 'approved', subscription_active = true,
      subscription_expires_at = now() + interval '100 years',
      business_permit_status = 'approved';

    insert into public.subscriptions (owner_id, status, is_free, started_at, expires_at)
    values (v_uid, 'active', true, now(), now() + interval '100 years')
    on conflict (owner_id) do update set
      status = 'active', is_free = true, expires_at = now() + interval '100 years', updated_at = now();
  end if;

  update public.profiles
  set previous_role = role,
      role = p_target_role::public.user_role,
      account_status = 'approved',
      onboarding_completed = true,
      id_verification_status = case when p_target_role = 'reseller' then 'approved' else id_verification_status end,
      demo_mode_started_at = now(),
      updated_at = now()
  where id = v_uid;
end;
$$;

revoke all on function public.switch_role_for_demo(text) from public, anon;
grant execute on function public.switch_role_for_demo(text) to authenticated;

-- Unchanged from 20260729000800 except clearing demo_mode_started_at.
create or replace function public.switch_back_to_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_previous public.user_role;
begin
  select previous_role into v_previous from public.profiles where id = v_uid;
  if v_previous is null then raise exception 'NOT_IN_DEMO_MODE'; end if;

  perform set_config('app.demo_role_switch', 'true', true);

  update public.profiles
  set role = v_previous, previous_role = null, demo_mode_started_at = null, updated_at = now()
  where id = v_uid;
end;
$$;

revoke all on function public.switch_back_to_admin() from public, anon;
grant execute on function public.switch_back_to_admin() to authenticated;

-- Same body as 20260728000300_storage_and_log_retention.sql plus one more
-- step: revert any account left stranded in demo mode for over an hour.
-- Restoration mirrors switch_back_to_admin() exactly (role = previous_role,
-- previous_role cleared) so a late-arriving click on "Back to Admin" after
-- the auto-revert already ran just gets NOT_IN_DEMO_MODE, same as if the
-- user had clicked it twice.
create or replace function public.run_operational_maintenance()
returns jsonb language plpgsql security definer set search_path=public as $$
declare hidden integer; completed integer; logins_purged integer; audit_purged integer; demo_reverted integer;
begin
  update public.products p set is_active=false where is_active and exists(select 1 from public.subscriptions s where s.owner_id=p.merchant_id and (s.status<>'active' or s.expires_at<=now())); get diagnostics hidden=row_count;
  completed:=public.complete_due_deliveries();

  delete from public.login_history where logged_in_at < now() - interval '90 days'; get diagnostics logins_purged=row_count;
  delete from public.activity_audit_logs where created_at < now() - interval '365 days'; get diagnostics audit_purged=row_count;

  perform set_config('app.demo_role_switch', 'true', true);
  update public.profiles
  set role = previous_role, previous_role = null, demo_mode_started_at = null, updated_at = now()
  where previous_role is not null
    and demo_mode_started_at is not null
    and demo_mode_started_at < now() - interval '1 hour';
  get diagnostics demo_reverted = row_count;

  return jsonb_build_object('products_paused',hidden,'orders_completed',completed,'login_history_purged',logins_purged,'audit_logs_purged',audit_purged,'demo_accounts_reverted',demo_reverted);
end $$;

revoke all on function public.run_operational_maintenance() from public,anon;
grant execute on function public.run_operational_maintenance() to authenticated;

notify pgrst, 'reload schema';
