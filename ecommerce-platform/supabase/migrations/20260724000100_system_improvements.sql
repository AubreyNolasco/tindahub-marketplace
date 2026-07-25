-- =====================================================================
-- JOM HUB System Improvements
--
-- 1. Business permit expiry tracking + auto-expire
-- 2. Admin-created merchants get fully activated (no permit/subscription
--    friction for admin-invited accounts)
-- 3. Admin-created resellers get ₱500 initial wallet balance so they
--    can start ordering without an immediate top-up
-- 4. Fix `enforce_merchant_permit_approval()` to allow admin bypass
-- 5. Update `get_admin_merchant_profiles` to include expiry field
--
-- Safe to run anytime. Every step is idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Add business_permit_expires_at column
-- ---------------------------------------------------------------------
alter table public.merchant_profiles
  add column if not exists business_permit_expires_at timestamptz;

-- ---------------------------------------------------------------------
-- 2. Fix enforce_merchant_permit_approval — admin can bypass
-- ---------------------------------------------------------------------
create or replace function public.enforce_merchant_permit_approval()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'approved' and new.business_permit_status <> 'approved' then
    if not public.is_admin() then
      raise exception 'BUSINESS_PERMIT_NOT_APPROVED';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_merchant_permit_approval on public.merchant_profiles;
create trigger trg_enforce_merchant_permit_approval before insert or update on public.merchant_profiles
for each row execute function public.enforce_merchant_permit_approval();

-- ---------------------------------------------------------------------
-- 3. Fix activate_account_invitation — admin-created merchants get FULL
--    activation (approved status, business permit bypassed, active
--    subscription). Admin-created resellers get ₱500 initial wallet.
-- ---------------------------------------------------------------------
create or replace function public.activate_account_invitation()
returns trigger language plpgsql security definer set search_path=public,auth as $$
declare
  v_inv public.account_invitations;
  v_email text;
  v_wallet_id uuid;
begin
  select lower(email) into v_email from auth.users where id=new.id;
  select * into v_inv from public.account_invitations where email=v_email and status='pending' limit 1;
  if v_inv.id is null then return new; end if;

  if v_inv.role='merchant' then
    update public.profiles
    set full_name=v_inv.full_name,
        phone=v_inv.phone,
        role=v_inv.role,
        account_status='approved',
        onboarding_completed=true
    where id=new.id;

    insert into public.merchant_profiles(id,business_name,status,
      business_permit_status,business_permit_notes,subscription_active)
    values(new.id,
      coalesce(nullif(trim(v_inv.business_name),''),v_inv.full_name),
      'approved',
      'approved','Bypassed — admin-created account',true)
    on conflict(id) do update set
      business_name=excluded.business_name,
      status='approved',
      business_permit_status='approved',
      business_permit_notes='Bypassed — admin-created account',
      subscription_active=true;

    insert into public.wallets(owner_id,balance) values(new.id,0) on conflict(owner_id) do nothing;
    insert into public.subscriptions(owner_id,status,is_free,started_at,expires_at)
    values(new.id,'active',true,now(),now()+interval '1 year')
    on conflict(owner_id) do nothing;
  else
    update public.profiles
    set full_name=v_inv.full_name,
        phone=v_inv.phone,
        role=v_inv.role,
        account_status='approved',
        onboarding_completed=true
    where id=new.id;

    insert into public.wallets(owner_id,balance) values(new.id,0) on conflict(owner_id) do nothing;
    select id into v_wallet_id from public.wallets where owner_id=new.id;
    update public.wallets set balance=balance+500,updated_at=now() where id=v_wallet_id;
    insert into public.wallet_transactions(wallet_id,amount,type,description)
    values(v_wallet_id,500,'credit','Welcome credit — admin-created account');

    insert into public.subscriptions(owner_id,status,is_free,started_at,expires_at)
    values(new.id,'active',true,now(),now()+interval '1 year')
    on conflict(owner_id) do nothing;
  end if;

  update public.account_invitations set status='accepted',accepted_at=now() where id=v_inv.id;
  return new;
end;
$$;

drop trigger if exists trg_activate_account_invitation on public.profiles;
create trigger trg_activate_account_invitation after insert on public.profiles
for each row execute function public.activate_account_invitation();

-- ---------------------------------------------------------------------
-- 4. Fix activate_existing_account_invitation (same logic for existing users)
-- ---------------------------------------------------------------------
create or replace function public.activate_existing_account_invitation()
returns trigger language plpgsql security definer set search_path=public,auth as $$
declare
  v_user_id uuid;
  v_wallet_id uuid;
begin
  if new.status<>'pending' then return new; end if;

  select id into v_user_id from auth.users where lower(email)=new.email limit 1;
  if v_user_id is null then return new; end if;

  if new.role='merchant' then
    update public.profiles
    set full_name=new.full_name,
        phone=new.phone,
        role=new.role,
        account_status='approved',
        onboarding_completed=true
    where id=v_user_id;

    insert into public.merchant_profiles(id,business_name,status,
      business_permit_status,business_permit_notes,subscription_active)
    values(v_user_id,
      coalesce(nullif(trim(new.business_name),''),new.full_name),
      'approved',
      'approved','Bypassed — admin-created account',true)
    on conflict(id) do update set
      business_name=excluded.business_name,
      status='approved',
      business_permit_status='approved',
      business_permit_notes='Bypassed — admin-created account',
      subscription_active=true;

    insert into public.wallets(owner_id,balance) values(v_user_id,0) on conflict(owner_id) do nothing;
    insert into public.subscriptions(owner_id,status,is_free,started_at,expires_at)
    values(v_user_id,'active',true,now(),now()+interval '1 year')
    on conflict(owner_id) do nothing;
  else
    update public.profiles
    set full_name=new.full_name,
        phone=new.phone,
        role=new.role,
        account_status='approved',
        onboarding_completed=true
    where id=v_user_id;

    insert into public.wallets(owner_id,balance) values(v_user_id,0) on conflict(owner_id) do nothing;
    select id into v_wallet_id from public.wallets where owner_id=v_user_id;
    update public.wallets set balance=balance+500,updated_at=now() where id=v_wallet_id;
    insert into public.wallet_transactions(wallet_id,amount,type,description)
    values(v_wallet_id,500,'credit','Welcome credit — admin-created account');

    insert into public.subscriptions(owner_id,status,is_free,started_at,expires_at)
    values(v_user_id,'active',true,now(),now()+interval '1 year')
    on conflict(owner_id) do nothing;
  end if;

  update public.account_invitations set status='accepted',accepted_at=now() where id=new.id;
  return new;
end;
$$;

drop trigger if exists trg_activate_existing_account_invitation on public.account_invitations;
create trigger trg_activate_existing_account_invitation
after insert or update of status on public.account_invitations
for each row execute function public.activate_existing_account_invitation();

-- ---------------------------------------------------------------------
-- 5. Update get_admin_merchant_profiles to include business_permit_expires_at
-- ---------------------------------------------------------------------
drop function if exists public.get_admin_merchant_profiles();
create function public.get_admin_merchant_profiles()
returns table (
  id uuid,
  business_name text,
  status public.merchant_status,
  created_at timestamptz,
  business_permit_url text,
  business_permit_status text,
  business_permit_notes text,
  business_permit_reviewed_at timestamptz,
  business_permit_reviewed_by uuid,
  business_permit_expires_at timestamptz,
  profile_full_name text,
  profile_phone text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  return query
  select
    mp.id,
    mp.business_name,
    mp.status,
    mp.created_at,
    mp.business_permit_url,
    mp.business_permit_status,
    mp.business_permit_notes,
    mp.business_permit_reviewed_at,
    mp.business_permit_reviewed_by,
    mp.business_permit_expires_at,
    p.full_name,
    p.phone
  from public.merchant_profiles mp
  join public.profiles p on p.id = mp.id
  order by mp.created_at desc;
end;
$$;

revoke all on function public.get_admin_merchant_profiles() from public, anon;
grant execute on function public.get_admin_merchant_profiles() to authenticated;

-- ---------------------------------------------------------------------
-- 6. Add maintenance function to auto-flag expired permits
-- ---------------------------------------------------------------------
create or replace function public.expire_business_permits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.merchant_profiles
  set business_permit_status = 'rejected',
      business_permit_notes = 'Business permit expired on ' || to_char(business_permit_expires_at, 'Mon DD, YYYY') || '. Please upload a renewed document.'
  where business_permit_status = 'approved'
    and business_permit_expires_at is not null
    and business_permit_expires_at < now()
  returning count(*) into v_count;

  return v_count;
end;
$$;

revoke all on function public.expire_business_permits() from public, anon;
grant execute on function public.expire_business_permits() to authenticated;

-- ---------------------------------------------------------------------
-- 7. Update get_my_merchant_profile to include expiry field
-- ---------------------------------------------------------------------
drop function if exists public.get_my_merchant_profile();
create function public.get_my_merchant_profile()
returns public.merchant_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.merchant_profiles;
begin
  select * into result
  from public.merchant_profiles
  where id = auth.uid();

  return result;
end;
$$;

revoke all on function public.get_my_merchant_profile() from public, anon;
grant execute on function public.get_my_merchant_profile() to authenticated;

notify pgrst, 'reload schema';

