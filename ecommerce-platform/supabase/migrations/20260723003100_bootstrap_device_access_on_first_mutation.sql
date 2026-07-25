-- require_active_device_for_mutation() currently rejects any write for a user
-- who has no row yet in user_device_access with 'DEVICE_APPROVAL_REQUIRED'.
-- That row is normally created by request_device_access(), called from the
-- DeviceAccessGuard component. But sync_google_profile() (called from
-- AuthContext on every Google login) also writes to public.profiles, which is
-- gated by this same trigger. Both calls fire independently right after login
-- with no ordering guarantee, so a brand-new user can lose the race: if
-- sync_google_profile's write is checked before request_device_access's insert
-- commits, the profile sync fails with DEVICE_APPROVAL_REQUIRED even though
-- there is no other device to conflict with.
--
-- Fix: when a user has no user_device_access row at all yet, the trigger
-- bootstraps one using the current request's own device id instead of
-- rejecting the write. This mirrors what request_device_access() already does
-- for a first-time device ('not found' branch), so behavior for genuine
-- multi-device conflicts is unchanged -- only the brand-new-user race goes away.

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
    raise exception 'DEVICE_APPROVAL_REQUIRED';
  end if;

  if tg_op='DELETE' then return old; end if;
  return new;
end
$$;

revoke all on function public.require_active_device_for_mutation() from public,anon,authenticated;

notify pgrst,'reload schema';
