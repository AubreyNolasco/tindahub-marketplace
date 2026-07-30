-- require_active_device_for_mutation() has required a verified TOTP second
-- factor (aal2) for writes to 23 sensitive tables (profiles, orders,
-- products, merchant_profiles, wallets, ...) since 20260723002900. This
-- was never a problem before today because MfaGuard.jsx forced every
-- signed-in user -- Reseller, Merchant, Admin alike -- through TOTP
-- enrollment before they could do anything, so everyone always reached
-- aal2 well before their first write.
--
-- MfaGuard.jsx was since scoped to the admin account only (per explicit
-- request: Reseller/Merchant should need just their one email OTP, not a
-- second authenticator step). That correctly stopped the frontend from
-- prompting regular users for MFA -- but this trigger was never updated
-- to match, so it kept demanding aal2 from accounts that now have no way
-- to ever reach it. Result: any Reseller/Merchant write to any of these
-- 23 tables -- including the very first profile sync on signup, via
-- sync_google_profile() or complete_account_onboarding() -- fails with
-- MFA_VERIFICATION_REQUIRED, surfacing as "Unable to load your profile".
--
-- Fix: only enforce the aal2 check for the same admin account MfaGuard.jsx
-- gates on. The device-approval check below it is a separate, unrelated
-- concern (one active device/session per account) and is left as-is for
-- everyone.

create or replace function public.require_active_device_for_mutation()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_device_id text;
  v_aal text;
begin
  if auth.uid() is null then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;

  if lower(coalesce(auth.jwt()->>'email','')) = 'nolascoaubrey32@gmail.com' then
    v_aal := coalesce(auth.jwt()->>'aal','aal1');
    if v_aal <> 'aal2' then
      raise exception 'MFA_VERIFICATION_REQUIRED';
    end if;
  end if;

  v_device_id := nullif(
    trim(coalesce(
      (nullif(current_setting('request.headers',true),'')::jsonb ->> 'x-jomhub-device-id'),
      ''
    )),
    ''
  );

  if v_device_id is null or not exists (
    select 1
    from public.user_device_access d
    where d.user_id=auth.uid()
      and d.active_device_id=v_device_id
  ) then
    raise exception 'DEVICE_APPROVAL_REQUIRED';
  end if;

  if tg_op='DELETE' then return old; end if;
  return new;
end
$$;

notify pgrst,'reload schema';
