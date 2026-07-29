-- Lets nolascoaubrey32@gmail.com (the platform's full-access admin) switch
-- their own account into Reseller or Merchant mode to fully exercise those
-- workspaces for demos -- placing real orders, managing real products,
-- topping up wallet, etc -- without a separate hardcoded test account.
-- previous_role remembers what to restore on switch-back. Every function
-- here only ever operates on the caller's own row.

alter table public.profiles add column if not exists previous_role public.user_role;

-- Narrow carve-out: allow a role change made by switch_back_to_admin() (role
-- reverting to exactly what previous_role recorded, clearing it in the same
-- update) even though the caller isn't admin at that moment. Nothing else
-- about this trigger's protections changes.
create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() and (
    new.id is distinct from old.id or
    (new.role is distinct from old.role and not (
      old.previous_role is not null and new.role = old.previous_role and new.previous_role is null
    )) or
    new.account_status is distinct from old.account_status or new.created_at is distinct from old.created_at or
    new.id_verification_reviewed_at is distinct from old.id_verification_reviewed_at or
    new.id_verification_reviewed_by is distinct from old.id_verification_reviewed_by or
    new.id_verification_notes is distinct from old.id_verification_notes or
    (new.id_verification_status is distinct from old.id_verification_status and
     not (old.id_verification_status in ('missing', 'rejected') and new.id_verification_status = 'pending'))
  ) then raise exception 'PROTECTED_PROFILE_FIELDS'; end if;
  new.full_name := left(trim(new.full_name), 120);
  new.phone := left(new.phone, 30);
  return new;
end; $$;

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

  update public.profiles
  set previous_role = role,
      role = p_target_role::public.user_role,
      account_status = 'approved',
      onboarding_completed = true,
      id_verification_status = case when p_target_role = 'reseller' then 'approved' else id_verification_status end,
      updated_at = now()
  where id = v_uid;

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
end;
$$;

revoke all on function public.switch_role_for_demo(text) from public, anon;
grant execute on function public.switch_role_for_demo(text) to authenticated;

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

  update public.profiles
  set role = v_previous, previous_role = null, updated_at = now()
  where id = v_uid;
end;
$$;

revoke all on function public.switch_back_to_admin() from public, anon;
grant execute on function public.switch_back_to_admin() to authenticated;

-- Wipes transactional data the admin generated while in demo mode (orders,
-- products, customers, wallet history, top-up/withdrawal requests). Does not
-- touch the profile, merchant_profiles, subscription, or wallet row itself
-- (wallet balance is reset to 0 instead of deleting the row).
create or replace function public.reset_admin_demo_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if (select lower(email) from auth.users where id = v_uid) <> 'nolascoaubrey32@gmail.com' then
    raise exception 'NOT_PERMITTED';
  end if;

  delete from public.wallet_transactions where wallet_id in (select id from public.wallets where owner_id = v_uid);
  delete from public.customer_payment_records where reseller_id = v_uid;
  delete from public.orders where reseller_id = v_uid or merchant_id = v_uid;
  delete from public.customers where reseller_id = v_uid;
  delete from public.products where merchant_id = v_uid;
  delete from public.merchant_campaigns where merchant_id = v_uid;
  delete from public.topup_requests where owner_id = v_uid;
  delete from public.withdrawal_requests where owner_id = v_uid;
  update public.wallets set balance = 0, updated_at = now() where owner_id = v_uid;
end;
$$;

revoke all on function public.reset_admin_demo_data() from public, anon;
grant execute on function public.reset_admin_demo_data() to authenticated;

notify pgrst, 'reload schema';
