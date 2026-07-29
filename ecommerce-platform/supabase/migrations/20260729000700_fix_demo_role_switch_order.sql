-- switch_role_for_demo() updated profiles.role to the target role BEFORE
-- upserting merchant_profiles. Since protect_merchant_privileges() gates
-- status/subscription_active/etc changes on is_admin() -- which itself
-- reads profiles.role for auth.uid() -- by the time the merchant_profiles
-- upsert ran, is_admin() already returned false (role was no longer
-- 'admin'), so the trigger raised PROTECTED_MERCHANT_FIELDS. Bootstrap
-- wallet/merchant_profiles/subscription first while still actually admin,
-- then flip profiles.role last.

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

notify pgrst, 'reload schema';
