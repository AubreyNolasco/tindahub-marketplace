-- Promote the verified Google account below to RM HUB Admin.
-- The user must first click "Continue with Google" in the app at least once.
do $$
declare
  v_user_id uuid;
  v_user auth.users;
begin
  select * into v_user
  from auth.users
  where lower(email) = lower('nolascoaubrey32@gmail.com')
  limit 1;

  if v_user.id is null then
    raise exception 'GOOGLE_ACCOUNT_NOT_FOUND: Sign in with Google in RM HUB first, then run this SQL again.';
  end if;

  v_user_id := v_user.id;
  if not exists (
    select 1 from auth.identities
    where user_id = v_user_id and provider = 'google'
  ) then
    raise exception 'GOOGLE_IDENTITY_REQUIRED: This account was not authenticated with Google.';
  end if;

  update public.profiles
  set role = 'admin',
      account_status = 'approved',
      onboarding_completed = true,
      email = lower(v_user.email),
      provider = 'google',
      full_name = left(coalesce(nullif(trim(v_user.raw_user_meta_data->>'full_name'), ''), nullif(trim(v_user.raw_user_meta_data->>'name'), ''), full_name), 120),
      avatar_url = coalesce(v_user.raw_user_meta_data->>'avatar_url', v_user.raw_user_meta_data->>'picture', avatar_url),
      updated_at = now()
  where id = v_user_id;

  if not found then
    raise exception 'PROFILE_NOT_FOUND: Run google_oauth_only_migration.sql, then sign in with Google again.';
  end if;
end $$;

-- Verification result: this must return exactly one approved Google Admin.
select p.id, p.full_name, p.email, p.provider, p.role, p.account_status
from public.profiles p
where lower(p.email) = lower('nolascoaubrey32@gmail.com');
