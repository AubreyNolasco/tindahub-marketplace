-- =====================================================================
-- Fixes: a real user signing in on a device other than their account's
-- currently-registered one gets hard-locked out with a raw
-- "DEVICE_APPROVAL_REQUIRED" error and a dead-end "Unable to load your
-- profile" screen, instead of the intended DeviceAccessGuard flow
-- ("New gadget wants access" / email approval prompt).
--
-- Root cause: 20260801000600_fix_device_gate_after_relogin.sql taught
-- request_device_access() that a genuinely fresh sign-in (real OTP/OAuth
-- grant within the last 5 minutes, proven by auth.users.last_sign_in_at)
-- should silently reclaim the device instead of opening the notify/
-- pending flow. But require_active_device_for_mutation() -- the trigger
-- that gates every other write on public.profiles/etc, including
-- sync_google_profile()'s own profile upsert called from AuthContext
-- immediately on login -- never got the same fix. So on a fresh login
-- from a new device, whichever of the two fires first wins: if
-- sync_google_profile's write reaches this trigger before
-- request_device_access's reclaim commits (a real, observed ordering --
-- they run from two independent effects with no coordination), the
-- trigger sees the still-mismatched device row and raises
-- DEVICE_APPROVAL_REQUIRED. AuthContext treats that as a fatal profile
-- load error and shows the "run this SQL migration and sign in again"
-- dead end -- the account is locked out by its own first write, before
-- the user-facing device-approval UI ever gets a chance to run.
--
-- Fix: mirror request_device_access()'s fresh-login exception here too,
-- so a real just-authenticated device is reclaimed instead of rejected,
-- regardless of which of the two writes happens to land first. A
-- replayed/stolen session token never touches last_sign_in_at, so that
-- attack path stays blocked exactly as before.
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

  v_aal := coalesce(auth.jwt()->>'aal', 'aal1');
  if v_aal <> 'aal2' then
    raise exception 'MFA_VERIFICATION_REQUIRED';
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
