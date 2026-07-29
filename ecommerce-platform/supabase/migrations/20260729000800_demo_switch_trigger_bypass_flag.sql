-- The demo role-switch needs to touch profiles.role, merchant_profiles
-- status/subscription fields, and subscriptions in the same transaction --
-- but two separate triggers have contradictory requirements: one demands
-- role='admin' (protect_merchant_privileges), the other demands
-- role='merchant' (require_merchant_subscription_owner). No insert order
-- satisfies both. Replaces the ordering dance with a single transaction-
-- local flag ('app.demo_role_switch') that switch_role_for_demo() and
-- switch_back_to_admin() set, and that all three protective triggers
-- accept as an explicit bypass. The flag is reset automatically at the end
-- of the transaction (set_config's is_local=true), so it can never leak
-- into unrelated statements.

create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and coalesce(current_setting('app.demo_role_switch', true), '') <> 'true'
     and (
    new.id is distinct from old.id or new.role is distinct from old.role or
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

create or replace function public.protect_merchant_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and coalesce(current_setting('app.demo_role_switch', true), '') <> 'true'
     and (
    new.id is distinct from old.id or new.status is distinct from old.status or
    new.subscription_active is distinct from old.subscription_active or
    new.subscription_expires_at is distinct from old.subscription_expires_at or
    new.trial_ends_at is distinct from old.trial_ends_at or new.created_at is distinct from old.created_at
  ) then raise exception 'PROTECTED_MERCHANT_FIELDS'; end if;
  new.business_name := left(trim(new.business_name), 160);
  new.business_description := left(new.business_description, 2000);
  new.business_address := left(new.business_address, 500);
  return new;
end; $$;

create or replace function public.require_merchant_subscription_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('app.demo_role_switch', true), '') = 'true' then
    return new;
  end if;
  if not exists (
    select 1
    from public.profiles p
    where p.id = new.owner_id
      and p.role = 'merchant'
  ) then
    raise exception 'MERCHANT_SUBSCRIPTION_ONLY';
  end if;
  return new;
end
$$;

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
      updated_at = now()
  where id = v_uid;
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

  perform set_config('app.demo_role_switch', 'true', true);

  update public.profiles
  set role = v_previous, previous_role = null, updated_at = now()
  where id = v_uid;
end;
$$;

revoke all on function public.switch_back_to_admin() from public, anon;
grant execute on function public.switch_back_to_admin() to authenticated;

notify pgrst, 'reload schema';
