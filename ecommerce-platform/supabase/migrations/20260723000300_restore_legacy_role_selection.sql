-- Older auth handlers marked a new account as an onboarded Reseller before the
-- user had selected a role. Restore onboarding only for clearly incomplete,
-- pending accounts; completed applications and fixed test accounts are kept.
update public.profiles p
set onboarding_completed = false,
    updated_at = now()
where p.role = 'reseller'
  and p.account_status = 'pending'
  and p.onboarding_completed = true
  and coalesce(trim(p.phone), '') = ''
  and coalesce(trim(p.address), '') = ''
  and lower(coalesce(p.email, '')) not in ('reseller@gmail.com', 'merchant@gmail.com')
  and not exists (select 1 from public.topup_requests t where t.owner_id = p.id)
  and not exists (select 1 from public.merchant_profiles m where m.id = p.id);

-- Keep repairing the same safe legacy state whenever a Google identity syncs.
create or replace function public.sync_google_profile()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user auth.users;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not exists (
    select 1 from auth.identities
    where user_id = auth.uid() and provider = 'google'
  ) then raise exception 'GOOGLE_AUTH_REQUIRED'; end if;

  select * into v_user from auth.users where id = auth.uid();
  perform set_config('app.google_onboarding', 'true', true);

  insert into public.profiles (
    id, full_name, email, avatar_url, provider, role, phone,
    account_status, onboarding_completed
  ) values (
    v_user.id,
    left(coalesce(
      nullif(trim(v_user.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(v_user.raw_user_meta_data->>'name'), ''),
      split_part(v_user.email, '@', 1)
    ), 120),
    lower(v_user.email),
    coalesce(v_user.raw_user_meta_data->>'avatar_url', v_user.raw_user_meta_data->>'picture'),
    'google', 'reseller', '', 'pending', false
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    provider = 'google',
    onboarding_completed = case
      when public.profiles.role = 'reseller'
        and public.profiles.account_status = 'pending'
        and public.profiles.onboarding_completed = true
        and coalesce(trim(public.profiles.phone), '') = ''
        and coalesce(trim(public.profiles.address), '') = ''
        and lower(coalesce(public.profiles.email, '')) not in ('reseller@gmail.com', 'merchant@gmail.com')
        and not exists (select 1 from public.topup_requests t where t.owner_id = public.profiles.id)
        and not exists (select 1 from public.merchant_profiles m where m.id = public.profiles.id)
      then false
      else public.profiles.onboarding_completed
    end,
    updated_at = now();

  insert into public.wallets (owner_id, balance)
  values (auth.uid(), 0)
  on conflict (owner_id) do nothing;
end;
$$;

revoke all on function public.sync_google_profile() from public, anon;
grant execute on function public.sync_google_profile() to authenticated;

notify pgrst, 'reload schema';
