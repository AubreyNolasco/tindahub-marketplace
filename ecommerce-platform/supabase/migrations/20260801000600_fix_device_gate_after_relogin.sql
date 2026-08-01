-- =====================================================================
-- Fixes: "Reseller/Merchant shuts down their PC, opens the site again,
-- and is always stuck on 'Waiting for device approval'."
--
-- Root cause: jomhub_device_id (deviceAccess.js) and the Supabase auth
-- session both live in localStorage under the same origin. Anything that
-- wipes localStorage on a full browser/PC restart -- a "clear cookies and
-- site data on exit" setting, or disk-restore/kiosk software common on
-- shared computers -- wipes both together. The user has to log in again
-- via email OTP (real proof of account ownership), gets a fresh random
-- device id in the process, and request_device_access() then treats that
-- as an untrusted new device: it emails a separate device-approval link
-- and blocks the UI behind DeviceAccessGuard until that's clicked. Same
-- person, same account, forced through two separate identity checks
-- back-to-back, and the second one reads as "the site is stuck."
--
-- Fix: a device id mismatch immediately after a *fresh* sign-in (i.e.
-- auth.users.last_sign_in_at was just set by a real OTP/OAuth grant, not
-- a silent token refresh) auto-reclaims the device instead of opening the
-- notify/pending flow. This still protects the actual thing this feature
-- guards against -- a copied/stolen session token being reused on a
-- second device without ever re-authenticating -- since replaying an
-- old token doesn't touch last_sign_in_at at all.
-- =====================================================================

create or replace function public.request_device_access(p_device_id text, p_device_label text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
  v_row public.user_device_access;
  v_token text;
  v_fresh_login boolean;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if length(trim(p_device_id)) < 16 or length(trim(p_device_id)) > 100 then raise exception 'INVALID_DEVICE'; end if;
  if length(trim(p_device_label)) < 3 then raise exception 'INVALID_DEVICE_LABEL'; end if;

  select (last_sign_in_at > now() - interval '5 minutes') into v_fresh_login
  from auth.users where id = auth.uid();

  select * into v_row from public.user_device_access where user_id=auth.uid() for update;
  if not found then
    insert into public.user_device_access(user_id,active_device_id,active_device_label)
    values(auth.uid(),left(trim(p_device_id),100),left(trim(p_device_label),160));
    return jsonb_build_object('status','active');
  end if;

  if v_row.active_device_id=p_device_id then
    update public.user_device_access set active_device_label=left(trim(p_device_label),160),updated_at=now() where user_id=auth.uid();
    return jsonb_build_object('status','active');
  end if;

  if coalesce(v_fresh_login, false) then
    update public.user_device_access set
      active_device_id=left(trim(p_device_id),100),
      active_device_label=left(trim(p_device_label),160),
      pending_device_id=null, pending_device_label=null, pending_token_hash=null, pending_status=null,
      updated_at=now()
    where user_id=auth.uid();
    return jsonb_build_object('status','active');
  end if;

  if v_row.pending_status='pending' and v_row.requested_at>now()-interval '2 minutes' then
    return jsonb_build_object('status',case when v_row.pending_device_id=p_device_id then 'pending' else 'rate_limited' end,'active_label',v_row.active_device_label);
  end if;
  v_token:=encode(gen_random_bytes(32),'hex');
  update public.user_device_access set pending_device_id=left(trim(p_device_id),100),pending_device_label=left(trim(p_device_label),160),
    pending_token_hash=encode(digest(v_token,'sha256'),'hex'),pending_status='pending',requested_at=now(),updated_at=now()
  where user_id=auth.uid();
  return jsonb_build_object('status','notify','token',v_token,'active_label',v_row.active_device_label);
end $$;

notify pgrst, 'reload schema';
