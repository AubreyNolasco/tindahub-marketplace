-- The client only needs sync_google_profile to complete successfully; it loads
-- the profile with a separate select. Returning the profiles composite can
-- become stale after profile columns are added and causes PostgreSQL's
-- "structure of query does not match function result type" error.
drop function if exists public.sync_google_profile();

create function public.sync_google_profile()
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
    updated_at = now();

  insert into public.wallets (owner_id, balance)
  values (auth.uid(), 0)
  on conflict (owner_id) do nothing;
end;
$$;

revoke all on function public.sync_google_profile() from public, anon;
grant execute on function public.sync_google_profile() to authenticated;

notify pgrst, 'reload schema';
