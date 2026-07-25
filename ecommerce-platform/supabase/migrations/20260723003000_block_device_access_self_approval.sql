-- The pending approval token from request_device_access() is returned directly
-- to the requesting (new) device so it can trigger the owner-notification email.
-- That means the new device itself knows the token and, until now, could call
-- resolve_device_access() with its own token to self-approve, completely
-- bypassing the out-of-band owner confirmation the feature depends on.
--
-- Every request carries the calling browser's own x-jomhub-device-id header
-- (see src/lib/supabase.js). Reject any resolution attempt made from the same
-- device that created the pending request -- only a different device (the
-- active gadget, the owner's phone reading the email, etc.) may resolve it.

create or replace function public.resolve_device_access(p_action text, p_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
  v_row public.user_device_access;
  v_caller_device_id text;
begin
  v_caller_device_id := nullif(
    trim(coalesce(
      (nullif(current_setting('request.headers',true),'')::jsonb ->> 'x-jomhub-device-id'),
      ''
    )),
    ''
  );

  select * into v_row from public.user_device_access
  where pending_status='pending' and requested_at>now()-interval '20 minutes'
    and pending_token_hash=encode(digest(p_token,'sha256'),'hex') for update;
  if not found then return jsonb_build_object('status','expired'); end if;

  if v_caller_device_id is null or v_caller_device_id=v_row.pending_device_id then
    return jsonb_build_object('status','expired');
  end if;

  if p_action='approve' then
    update public.user_device_access set active_device_id=pending_device_id,active_device_label=pending_device_label,
      pending_status='approved',pending_token_hash=null,updated_at=now() where user_id=v_row.user_id;
    return jsonb_build_object('status','approved');
  elsif p_action='block' then
    update public.user_device_access set pending_status='blocked',pending_token_hash=null,updated_at=now() where user_id=v_row.user_id;
    return jsonb_build_object('status','blocked');
  end if;
  return jsonb_build_object('status','invalid');
end $$;

notify pgrst,'reload schema';
