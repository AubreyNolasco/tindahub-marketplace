-- =====================================================================
-- HOTFIX for a regression introduced by this session's own
-- 20260810000100_fresh_login_reclaims_device_on_mutation.sql.
--
-- That migration's `create or replace function
-- require_active_device_for_mutation()` was written by copying the
-- function body from 20260723003100 (the trigger's original form) and
-- adding the fresh-login device-reclaim logic to it. It did not account
-- for 20260730000400_fix_mfa_gate_broke_regular_signups.sql, a later
-- migration that scoped the trigger's `aal2` (MFA) requirement to the
-- single admin account (nolascoaubrey32@gmail.com) only -- because
-- MfaGuard.jsx only ever enrolls that one account in TOTP, so no other
-- account can ever reach aal2. 20260810000100 silently reintroduced the
-- unscoped check, meaning every write by every non-admin user (reseller
-- or merchant) to any of the 23+ tables this trigger guards --
-- including sync_google_profile()'s own profile upsert on login --
-- started failing with MFA_VERIFICATION_REQUIRED the moment that
-- migration was applied. This is the exact bug 20260730000400 already
-- fixed once, reintroduced by this session for one migration's worth of
-- production time.
--
-- Fix: restore the admin-only scoping on the aal2 check, keeping the
-- fresh-login device-reclaim logic 20260810000100 added.
-- =====================================================================

create or replace function public.require_active_device_for_mutation()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_device_id text;
  v_aal text;
  v_fresh_login boolean;
begin
  if auth.uid() is null then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;

  if lower(coalesce(auth.jwt()->>'email','')) = 'nolascoaubrey32@gmail.com' then
    v_aal := coalesce(auth.jwt()->>'aal', 'aal1');
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

  if v_device_id is null then
    raise exception 'DEVICE_APPROVAL_REQUIRED';
  end if;

  insert into public.user_device_access(user_id,active_device_id,active_device_label)
  values(auth.uid(), v_device_id, 'Unknown device')
  on conflict(user_id) do nothing;

  if not exists (
    select 1
    from public.user_device_access d
    where d.user_id=auth.uid()
      and d.active_device_id=v_device_id
  ) then
    select (last_sign_in_at > now() - interval '5 minutes') into v_fresh_login
    from auth.users where id = auth.uid();

    if coalesce(v_fresh_login, false) then
      update public.user_device_access set
        active_device_id = v_device_id,
        active_device_label = 'Unknown device',
        pending_device_id = null, pending_device_label = null, pending_token_hash = null, pending_status = null,
        updated_at = now()
      where user_id = auth.uid();
    else
      raise exception 'DEVICE_APPROVAL_REQUIRED';
    end if;
  end if;

  if tg_op='DELETE' then return old; end if;
  return new;
end
$$;

revoke all on function public.require_active_device_for_mutation() from public,anon,authenticated;

notify pgrst,'reload schema';
