-- Permanent exceptions for the two explicitly named TEST accounts only.
-- Real reseller and merchant accounts keep the normal approval workflow.
begin;

do $$
declare
  v_merchant_id uuid;
  v_reseller_id uuid;
begin
  select id into v_merchant_id
  from auth.users
  where lower(email) = lower('merchant@gmail.com');

  select id into v_reseller_id
  from auth.users
  where lower(email) = lower('reseller@gmail.com');

  if v_merchant_id is null or v_reseller_id is null then
    raise exception 'Both test users must sign in with Google once before this script is run.';
  end if;

  perform set_config('app.google_onboarding', 'true', true);

  update public.profiles
  set role = 'merchant'::public.user_role,
      account_status = 'approved',
      onboarding_completed = true,
      provider = 'google',
      updated_at = now()
  where id = v_merchant_id;

  update public.profiles
  set role = 'reseller'::public.user_role,
      account_status = 'approved',
      onboarding_completed = true,
      provider = 'google',
      updated_at = now()
  where id = v_reseller_id;

  -- Real, structured PSGC address (Barangay Bagong Pag-asa, Quezon City,
  -- Metro Manila) with pickup coordinates, so the test merchant is a valid
  -- distance/shipping-fee origin instead of an unmappable placeholder string.
  insert into public.merchant_profiles (
    id, business_name, business_description, business_address, status,
    subscription_active, subscription_expires_at,
    business_permit_status, business_permit_notes, business_permit_reviewed_at,
    street, barangay, city, province, postal_code, pickup_latitude, pickup_longitude
  ) values (
    v_merchant_id,
    'JOM HUB Test Merchant',
    'Internal test merchant account',
    '12 Mother Ignacia Avenue, Barangay Bagong Pag-asa, Quezon City, Metro Manila, 1105',
    'approved',
    true,
    now() + interval '100 years',
    'approved',
    'Internal test account exemption',
    now(),
    '12 Mother Ignacia Avenue', 'Bagong Pag-asa', 'Quezon City', 'Metro Manila', '1105',
    14.648000, 121.035000
  )
  on conflict (id) do update set
    business_name = excluded.business_name,
    business_description = excluded.business_description,
    business_address = excluded.business_address,
    status = 'approved',
    subscription_active = true,
    subscription_expires_at = excluded.subscription_expires_at,
    business_permit_status = 'approved',
    business_permit_notes = excluded.business_permit_notes,
    business_permit_reviewed_at = now(),
    street = excluded.street,
    barangay = excluded.barangay,
    city = excluded.city,
    province = excluded.province,
    postal_code = excluded.postal_code,
    pickup_latitude = excluded.pickup_latitude,
    pickup_longitude = excluded.pickup_longitude;

  insert into public.wallets (owner_id, balance)
  values (v_merchant_id, 10000000), (v_reseller_id, 10000000)
  on conflict (owner_id) do update set balance = 10000000;

  insert into public.subscriptions (owner_id, status, is_free, started_at, expires_at)
  values
    (v_merchant_id, 'active', true, now(), now() + interval '100 years'),
    (v_reseller_id, 'active', true, now(), now() + interval '100 years')
  on conflict (owner_id) do update set
    status = 'active',
    is_free = true,
    expires_at = now() + interval '100 years',
    updated_at = now();
end $$;

commit;
