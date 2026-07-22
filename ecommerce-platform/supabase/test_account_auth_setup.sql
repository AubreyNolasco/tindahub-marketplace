-- Email OTP for real accounts, with password bypass for two test accounts.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text := lower(coalesce(new.email, ''));
  v_provider text := coalesce(new.raw_app_meta_data->>'provider', '');
  v_is_test boolean := v_email in ('reseller@gmail.com', 'merchant@gmail.com');
  v_role public.user_role;
begin
  if v_provider not in ('google', 'email') and not v_is_test then
    raise exception 'EMAIL_AUTH_REQUIRED';
  end if;

  v_role := case when v_email = 'merchant@gmail.com'
    then 'merchant'::public.user_role else 'reseller'::public.user_role end;

  insert into public.profiles (
    id, full_name, email, avatar_url, provider, role, phone,
    account_status, onboarding_completed
  ) values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)), 120),
    v_email,
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    case when v_is_test then 'email-test' when v_provider = 'google' then 'google' else 'email' end,
    case when v_is_test then v_role else 'reseller'::public.user_role end,
    '',
    case when v_is_test then 'approved' else 'pending' end,
    v_is_test
  ) on conflict (id) do nothing;

  insert into public.wallets (owner_id, balance)
  values (new.id, case when v_is_test then 10000000 else 0 end)
  on conflict (owner_id) do update
    set balance = case when v_is_test then 10000000 else public.wallets.balance end;

  if v_is_test and v_role = 'merchant' then
    insert into public.merchant_profiles (
      id, business_name, business_description, business_address, status,
      subscription_active, subscription_expires_at,
      business_permit_status, business_permit_notes, business_permit_reviewed_at
    ) values (
      new.id, 'JOM HUB Test Merchant', 'Internal test merchant account',
      'Internal test address - not for real deliveries', 'approved', true,
      now() + interval '100 years', 'approved',
      'Internal test account exemption', now()
    ) on conflict (id) do nothing;
  end if;

  if v_is_test then
    insert into public.subscriptions (owner_id, status, is_free, started_at, expires_at)
    values (new.id, 'active', true, now(), now() + interval '100 years')
    on conflict (owner_id) do update set
      status = 'active', is_free = true,
      expires_at = now() + interval '100 years', updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.complete_google_onboarding(
  p_role text,
  p_phone text,
  p_address text,
  p_business_name text default null,
  p_topup_amount numeric default null,
  p_payment_method text default null,
  p_reference_number text default null,
  p_proof_url text default null
) returns public.profiles
language plpgsql security definer set search_path = public, auth as $$
declare v_profile public.profiles;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if p_role not in ('merchant', 'reseller') then raise exception 'INVALID_ROLE'; end if;
  if not exists (
    select 1 from auth.identities
    where user_id = auth.uid() and provider in ('google', 'email')
  ) then raise exception 'VERIFIED_EMAIL_REQUIRED'; end if;
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and provider in ('google', 'email') and onboarding_completed = false
  ) then raise exception 'ONBOARDING_ALREADY_COMPLETED'; end if;
  if char_length(trim(coalesce(p_phone, ''))) < 7 then raise exception 'VALID_PHONE_REQUIRED'; end if;
  if char_length(trim(coalesce(p_address, ''))) < 12 then raise exception 'COMPLETE_ADDRESS_REQUIRED'; end if;
  if p_role = 'merchant' and char_length(trim(coalesce(p_business_name, ''))) < 2 then raise exception 'BUSINESS_NAME_REQUIRED'; end if;
  if p_role = 'reseller' and (
    coalesce(p_topup_amount, 0) <= 0 or
    p_payment_method not in ('gcash','maya','bank_transfer') or p_proof_url is null
  ) then raise exception 'VALID_INITIAL_TOPUP_REQUIRED'; end if;

  perform set_config('app.google_onboarding', 'true', true);
  update public.profiles set
    role = p_role::public.user_role,
    phone = left(trim(p_phone), 30),
    address = left(trim(p_address), 500),
    account_status = 'pending',
    onboarding_completed = true,
    updated_at = now()
  where id = auth.uid() returning * into v_profile;

  if p_role = 'merchant' then
    insert into public.merchant_profiles (id, business_name, business_address, status)
    values (auth.uid(), left(trim(p_business_name), 160), left(trim(p_address), 500), 'pending')
    on conflict (id) do update set
      business_name = excluded.business_name,
      business_address = excluded.business_address;
  end if;

  insert into public.wallets (owner_id, balance)
  values (auth.uid(), 0) on conflict (owner_id) do nothing;

  if p_role = 'reseller' then
    insert into public.topup_requests (owner_id, amount, method, reference_number, proof_url, status)
    values (
      auth.uid(), p_topup_amount, p_payment_method::public.payment_method,
      left(trim(coalesce(p_reference_number, '')), 120), p_proof_url, 'pending'
    );
  end if;
  return v_profile;
end;
$$;

revoke all on function public.complete_google_onboarding(text,text,text,text,numeric,text,text,text) from public, anon;
grant execute on function public.complete_google_onboarding(text,text,text,text,numeric,text,text,text) to authenticated;

notify pgrst, 'reload schema';
