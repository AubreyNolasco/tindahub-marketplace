-- Require a verified TOTP second factor (AAL2) as well as the approved active
-- device for authenticated writes to sensitive production tables.

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

  v_aal := coalesce(auth.jwt()->>'aal','aal1');
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

revoke all on function public.require_active_device_for_mutation() from public,anon,authenticated;

notify pgrst,'reload schema';
