-- One-time admin promotion for the requested Google account.
update public.profiles
set
  role = 'admin'::public.user_role,
  account_status = 'approved',
  onboarding_completed = true,
  updated_at = now()
where lower(email) = lower('nolascoaubrey32@gmail.com');

do $$
begin
  if not exists (
    select 1 from public.profiles
    where lower(email) = lower('nolascoaubrey32@gmail.com')
      and role = 'admin'
      and account_status = 'approved'
  ) then
    raise exception 'Account not found or admin promotion failed. Sign in with Google first, then run this script again.';
  end if;
end $$;
