-- Remove the legacy production exception that automatically approved two
-- hard-coded test email addresses and credited them with large wallet balances.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_email text := lower(coalesce(new.email,''));
  v_provider text := coalesce(new.raw_app_meta_data->>'provider','');
begin
  if v_provider not in ('google','email') then
    raise exception 'EMAIL_AUTH_REQUIRED';
  end if;

  insert into public.profiles(
    id,full_name,email,avatar_url,provider,role,phone,
    account_status,onboarding_completed
  )
  values(
    new.id,
    left(coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'),''),
      nullif(trim(new.raw_user_meta_data->>'name'),''),
      split_part(new.email,'@',1)
    ),120),
    v_email,
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    ),
    v_provider,
    'reseller'::public.user_role,
    '',
    'pending',
    false
  )
  on conflict(id) do nothing;

  insert into public.wallets(owner_id,balance)
  values(new.id,0)
  on conflict(owner_id) do nothing;

  return new;
end
$$;

revoke all on function public.handle_new_user() from public,anon,authenticated;

notify pgrst,'reload schema';
