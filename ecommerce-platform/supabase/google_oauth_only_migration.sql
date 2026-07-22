-- Google OAuth-only identity profiles and marketplace onboarding.
-- Run after the existing schema and security migrations.
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists provider text;
alter table public.profiles add column if not exists onboarding_completed boolean not null default true;

update public.profiles p set
  email = lower(u.email),
  provider = coalesce(u.raw_app_meta_data->>'provider', 'legacy')
from auth.users u where u.id = p.id and (p.email is null or p.provider is null);

create unique index if not exists profiles_email_unique on public.profiles(lower(email)) where email is not null;

-- Google is the authoritative source for name, email, and avatar.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if coalesce(new.raw_app_meta_data->>'provider', '') <> 'google' then
    raise exception 'GOOGLE_AUTH_REQUIRED';
  end if;

  insert into public.profiles (
    id, full_name, email, avatar_url, provider, role, phone, account_status, onboarding_completed
  ) values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1)), 120),
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    'google',
    'reseller',
    '',
    'pending',
    false
  ) on conflict (id) do nothing;

  insert into public.wallets (owner_id, balance) values (new.id, 0)
  on conflict (owner_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Preserve protected fields while allowing the one-time trusted onboarding RPC.
create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_onboarding boolean := coalesce(current_setting('app.google_onboarding', true), 'false') = 'true';
begin
  if auth.uid() is not null and not public.is_admin() and not v_onboarding and (
    new.id is distinct from old.id or new.role is distinct from old.role or
    new.account_status is distinct from old.account_status or
    new.onboarding_completed is distinct from old.onboarding_completed or
    new.created_at is distinct from old.created_at
  ) then raise exception 'PROTECTED_PROFILE_FIELDS'; end if;

  if auth.uid() is not null and not public.is_admin() and not v_onboarding and (
    new.email is distinct from old.email or new.provider is distinct from old.provider or
    new.avatar_url is distinct from old.avatar_url
  ) then raise exception 'GOOGLE_IDENTITY_FIELDS_ARE_READ_ONLY'; end if;
  new.full_name := left(trim(new.full_name), 120);
  new.phone := left(coalesce(new.phone, ''), 30);
  return new;
end;
$$;
drop trigger if exists trg_protect_profile_privileges on public.profiles;
create trigger trg_protect_profile_privileges before update on public.profiles
for each row execute function public.protect_profile_privileges();

create or replace function public.sync_google_profile()
returns public.profiles language plpgsql security definer set search_path = public, auth as $$
declare v_user auth.users; v_profile public.profiles;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not exists (select 1 from auth.identities where user_id = auth.uid() and provider = 'google') then
    raise exception 'GOOGLE_AUTH_REQUIRED';
  end if;
  select * into v_user from auth.users where id = auth.uid();
  perform set_config('app.google_onboarding', 'true', true);
  update public.profiles set
    full_name = left(coalesce(nullif(trim(v_user.raw_user_meta_data->>'full_name'), ''), nullif(trim(v_user.raw_user_meta_data->>'name'), ''), full_name), 120),
    email = lower(v_user.email),
    avatar_url = coalesce(v_user.raw_user_meta_data->>'avatar_url', v_user.raw_user_meta_data->>'picture', avatar_url),
    provider = 'google',
    updated_at = now()
  where id = auth.uid() returning * into v_profile;
  return v_profile;
end;
$$;
revoke all on function public.sync_google_profile() from public;
grant execute on function public.sync_google_profile() to authenticated;

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
  if not exists (select 1 from auth.identities where user_id = auth.uid() and provider = 'google') then
    raise exception 'GOOGLE_AUTH_REQUIRED';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and provider = 'google' and onboarding_completed = false) then
    raise exception 'ONBOARDING_ALREADY_COMPLETED';
  end if;
  if char_length(trim(coalesce(p_phone, ''))) < 7 then raise exception 'VALID_PHONE_REQUIRED'; end if;
  if char_length(trim(coalesce(p_address, ''))) < 12 then raise exception 'COMPLETE_ADDRESS_REQUIRED'; end if;
  if p_role = 'merchant' and char_length(trim(coalesce(p_business_name, ''))) < 2 then raise exception 'BUSINESS_NAME_REQUIRED'; end if;
  if p_role = 'reseller' and (coalesce(p_topup_amount, 0) <= 0 or p_payment_method not in ('gcash','maya','bank_transfer') or p_proof_url is null) then
    raise exception 'VALID_INITIAL_TOPUP_REQUIRED';
  end if;

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
    on conflict (id) do update set business_name = excluded.business_name, business_address = excluded.business_address;
  end if;
  insert into public.wallets (owner_id, balance) values (auth.uid(), 0) on conflict (owner_id) do nothing;
  if p_role = 'reseller' then
    insert into public.topup_requests (owner_id, amount, method, reference_number, proof_url, status)
    values (auth.uid(), p_topup_amount, p_payment_method::public.payment_method, left(trim(coalesce(p_reference_number, '')), 120), p_proof_url, 'pending');
  end if;
  return v_profile;
end;
$$;
revoke all on function public.complete_google_onboarding(text,text,text,text,numeric,text,text,text) from public;
grant execute on function public.complete_google_onboarding(text,text,text,text,numeric,text,text,text) to authenticated;

-- Users may read their own Google-created profile; admins retain existing access.
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());
