-- End-to-end Google OAuth repair for reseller and merchant account creation.
-- Run after all existing migrations. Safe to run more than once.

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists provider text;
alter table public.profiles add column if not exists onboarding_completed boolean not null default true;

create unique index if not exists profiles_email_unique
  on public.profiles(lower(email)) where email is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if coalesce(new.raw_app_meta_data->>'provider', '') <> 'google' then
    raise exception 'GOOGLE_AUTH_REQUIRED';
  end if;

  insert into public.profiles (
    id, full_name, email, avatar_url, provider, role, phone,
    account_status, onboarding_completed
  ) values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1)), 120),
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    'google', 'reseller', '', 'pending', false
  ) on conflict (id) do nothing;

  insert into public.wallets (owner_id, balance)
  values (new.id, 0) on conflict (owner_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Sync Google identity and repair accounts created before the trigger existed.
create or replace function public.sync_google_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user auth.users;
  v_profile public.profiles;
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
    left(coalesce(nullif(trim(v_user.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(v_user.raw_user_meta_data->>'name'), ''), split_part(v_user.email, '@', 1)), 120),
    lower(v_user.email),
    coalesce(v_user.raw_user_meta_data->>'avatar_url', v_user.raw_user_meta_data->>'picture'),
    'google', 'reseller', '', 'pending', false
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    provider = 'google',
    updated_at = now()
  returning * into v_profile;

  insert into public.wallets (owner_id, balance)
  values (auth.uid(), 0) on conflict (owner_id) do nothing;
  return v_profile;
end;
$$;

revoke all on function public.sync_google_profile() from public, anon;
grant execute on function public.sync_google_profile() to authenticated;

-- Owners need their complete merchant verification state, while the public
-- merchant table continues exposing only its safe columns.
create or replace function public.get_my_merchant_profile()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(mp)
  from public.merchant_profiles mp
  where mp.id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'merchant'
    );
$$;

revoke all on function public.get_my_merchant_profile() from public, anon;
grant execute on function public.get_my_merchant_profile() to authenticated;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_admin());

notify pgrst, 'reload schema';
