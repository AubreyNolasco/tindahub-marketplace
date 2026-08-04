-- =====================================================================
-- Staff Access & Invitations — Production Fix
-- =====================================================================
-- Applies the Staff Accounts feature to a production database that already
-- contains the security hardening from:
--   * 20260729000100_reseller_id_verification.sql  (protect_profile_privileges)
--   * 20260730000500_fix_merchant_onboarding_role_lock.sql (onboarding exception)
--   * 20260723002700_production_security_hardening.sql (device gate)
--   * 20260730000400_fix_mfa_gate_broke_regular_signups.sql (MFA scope)
--
-- Key design:
--   1. Staff role is appended to the user_role enum (idempotent).
--   2. staff_invitations / staff_access tables + RLS, fully idempotent.
--   3. Admin staff activation is performed through a SECURITY DEFINER RPC
--      (create_staff_invitation, revoke_staff_invitation, update_staff_access,
--      deactivate_staff, activate_staff) so the only app-level path into
--      these tables is the admin — never a raw client write.
--   4. The staff activation triggers set a transaction-local bypass flag
--      (app.staff_activation) that protect_profile_privileges() accepts,
--      mirroring the existing app.demo_role_switch bypass. This is the ONLY
--      additional carve-out and only fires for a matching pending invitation
--      during signup, so it cannot be reused for self-promotion.
--   5. Compatible with require_active_device_for_mutation: that trigger
--      returns early when auth.uid() is null (internal auth-trigger writes),
--      and admin RPCs carry the admin's approved device header.
--
-- Safe to run more than once (idempotent).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Add 'staff' to user_role (idempotent)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumtypid = 'public.user_role'::regtype and enumlabel = 'staff'
  ) then
    alter type public.user_role add value if not exists 'staff';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Tables (idempotent)
-- ---------------------------------------------------------------------
create table if not exists public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(trim(email))),
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  permissions text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  invited_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create table if not exists public.staff_access (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  permissions text[] not null default '{}',
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_staff_invitations_email on public.staff_invitations(lower(email));
create index if not exists idx_staff_invitations_status on public.staff_invitations(status);
create index if not exists idx_staff_access_permissions on public.staff_access using gin(permissions);

alter table public.staff_invitations enable row level security;
alter table public.staff_access enable row level security;

-- ---------------------------------------------------------------------
-- 1b. Device gate on the new staff tables, matching the production
--      hardening applied to other sensitive tables (20260723002700).
--      require_active_device_for_mutation() returns early when
--      auth.uid() is null, so internal staff-activation triggers (which
--      fire from the auth.users insert) are not blocked.
-- ---------------------------------------------------------------------
drop trigger if exists require_active_device_mutation on public.staff_invitations;
create trigger require_active_device_mutation before insert or update or delete on public.staff_invitations
for each row execute function public.require_active_device_for_mutation();
drop trigger if exists require_active_device_mutation on public.staff_access;
create trigger require_active_device_mutation before insert or update or delete on public.staff_access
for each row execute function public.require_active_device_for_mutation();

-- ---------------------------------------------------------------------
-- 2. has_admin_permission() — supports admin (full) + staff (per-module)
-- ---------------------------------------------------------------------
create or replace function public.has_admin_permission(p_permission text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
    or coalesce((select active and p_permission = any(permissions) from public.staff_access where user_id = auth.uid()), false);
$$;
revoke all on function public.has_admin_permission(text) from public, anon;
grant execute on function public.has_admin_permission(text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. RLS policies (recreate idempotently)
-- ---------------------------------------------------------------------
drop policy if exists "staff_invitations_admin_manage" on public.staff_invitations;
create policy "staff_invitations_admin_manage" on public.staff_invitations for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "staff_access_admin_manage" on public.staff_access;
create policy "staff_access_admin_manage" on public.staff_access for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "staff_access_read_own" on public.staff_access;
create policy "staff_access_read_own" on public.staff_access for select to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.staff_invitations, public.staff_access to authenticated;

-- ---------------------------------------------------------------------
-- 4. Admin RPCs (SECURITY DEFINER, locked search_path)
-- ---------------------------------------------------------------------
create or replace function public.create_staff_invitation(
  p_email text,
  p_full_name text,
  p_permissions text[]
)
returns public.staff_invitations
language plpgsql security definer set search_path = public as $$
declare
  v_invite public.staff_invitations;
  v_email text := lower(trim(p_email));
  v_name text := trim(p_full_name);
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if v_email = '' or v_email !~ '@' then raise exception 'INVALID_EMAIL'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then raise exception 'INVALID_NAME'; end if;
  if p_permissions is null or array_length(p_permissions, 1) = 0 then raise exception 'NO_PERMISSIONS'; end if;

  insert into public.staff_invitations (email, full_name, permissions, status, invited_by)
  values (v_email, v_name, p_permissions, 'pending', auth.uid())
  on conflict (email) do update set
    full_name = excluded.full_name,
    permissions = excluded.permissions,
    status = 'pending',
    invited_by = excluded.invited_by,
    accepted_at = null
  returning * into v_invite;

  return v_invite;
end $$;
revoke all on function public.create_staff_invitation(text, text, text[]) from public, anon;
grant execute on function public.create_staff_invitation(text, text, text[]) to authenticated;

create or replace function public.revoke_staff_invitation(p_invite_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  update public.staff_invitations set status = 'revoked' where id = p_invite_id and status = 'pending';
end $$;
revoke all on function public.revoke_staff_invitation(uuid) from public, anon;
grant execute on function public.revoke_staff_invitation(uuid) to authenticated;

create or replace function public.update_staff_access(
  p_user_id uuid,
  p_permissions text[]
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  update public.staff_access set permissions = p_permissions, updated_at = now() where user_id = p_user_id;
  if not found then raise exception 'STAFF_NOT_FOUND'; end if;
end $$;
revoke all on function public.update_staff_access(uuid, text[]) from public, anon;
grant execute on function public.update_staff_access(uuid, text[]) to authenticated;

create or replace function public.set_staff_active(p_user_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  update public.staff_access set active = p_active, updated_at = now() where user_id = p_user_id;
  if not found then raise exception 'STAFF_NOT_FOUND'; end if;
end $$;
revoke all on function public.set_staff_active(uuid, boolean) from public, anon;
grant execute on function public.set_staff_active(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 4b. protect_profile_privileges() — accept the staff-activation bypass
-- ---------------------------------------------------------------------
-- The existing trigger (from 20260730000500) blocks any non-admin role
-- change unless it is the onboarding_completed false->true transition.
-- Staff activation needs to set role='staff' during a profile update that
-- is NOT an onboarding_completed transition (it is already true for
-- existing users or set alongside the role change). Add app.staff_activation
-- as an explicit, transaction-local bypass — mirroring the existing
-- app.demo_role_switch flag. restore the original protections otherwise.
create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_onboarding_completion boolean := old.onboarding_completed = false and new.onboarding_completed = true;
  v_staff_activation boolean := coalesce(current_setting('app.staff_activation', true), '') = 'true';
begin
  if auth.uid() is not null and not public.is_admin()
     and coalesce(current_setting('app.demo_role_switch', true), '') <> 'true'
     and not v_staff_activation
     and (
    new.id is distinct from old.id or
    (new.role is distinct from old.role and not v_onboarding_completion) or
    (new.account_status is distinct from old.account_status and not v_onboarding_completion) or
    new.created_at is distinct from old.created_at or
    new.id_verification_reviewed_at is distinct from old.id_verification_reviewed_at or
    new.id_verification_reviewed_by is distinct from old.id_verification_reviewed_by or
    new.id_verification_notes is distinct from old.id_verification_notes or
    (new.id_verification_status is distinct from old.id_verification_status and
     not (old.id_verification_status in ('missing', 'rejected') and new.id_verification_status = 'pending'))
  ) then raise exception 'PROTECTED_PROFILE_FIELDS'; end if;
  new.full_name := left(trim(new.full_name), 120);
  new.phone := left(new.phone, 30);
  return new;
end; $$;
drop trigger if exists trg_protect_profile_privileges on public.profiles;
create trigger trg_protect_profile_privileges before update on public.profiles
for each row execute function public.protect_profile_privileges();

-- ---------------------------------------------------------------------
-- 5. Staff activation triggers
-- ---------------------------------------------------------------------
-- These fire on NEW signups (auth.users -> profiles insert) and on new
-- invitations where the invited email already has an account. They set a
-- transaction-local bypass flag (app.staff_activation) so the
-- protect_profile_privileges() trigger allows the role -> 'staff' change.
-- require_active_device_for_mutation() returns early when auth.uid() is
-- null (these fire from auth triggers, not a user request), so it grants
-- cleanly.
-- ---------------------------------------------------------------------
create or replace function public.activate_invited_staff()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  v_invite public.staff_invitations;
begin
  select i.* into v_invite from public.staff_invitations i
  join auth.users u on lower(u.email) = i.email
  where u.id = new.id and i.status = 'pending' limit 1;
  if v_invite.id is null then return new; end if;

  perform set_config('app.staff_activation', 'true', true);

  update public.profiles set role = 'staff', full_name = v_invite.full_name,
    account_status = 'approved', onboarding_completed = true where id = new.id;

  insert into public.staff_access(user_id, permissions, active, created_by)
  values(new.id, v_invite.permissions, true, v_invite.invited_by)
  on conflict(user_id) do update set permissions=excluded.permissions, active=true, updated_at=now();

  update public.staff_invitations set status='accepted', accepted_at=now() where id=v_invite.id;
  return new;
end; $$;
drop trigger if exists trg_activate_invited_staff on public.profiles;
create trigger trg_activate_invited_staff after insert on public.profiles for each row execute function public.activate_invited_staff();

create or replace function public.activate_existing_invited_staff()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  v_user_id uuid;
begin
  if new.status <> 'pending' then return new; end if;
  select id into v_user_id from auth.users where lower(email) = new.email limit 1;
  if v_user_id is null then return new; end if;

  -- If the invited user already answered a role prompt, do not silently
  -- flip them to staff; only activate when they have no conflicting role.
  if exists (select 1 from public.profiles where id = v_user_id and role in ('merchant')) then
    return new;
  end if;

  perform set_config('app.staff_activation', 'true', true);

  update public.profiles set role='staff', full_name=new.full_name,
    account_status='approved', onboarding_completed=true where id=v_user_id;

  insert into public.staff_access(user_id,permissions,active,created_by)
  values(v_user_id,new.permissions,true,new.invited_by)
  on conflict(user_id) do update set permissions=excluded.permissions,active=true,updated_at=now();

  update public.staff_invitations set status='accepted',accepted_at=now() where id=new.id;
  return new;
end; $$;
drop trigger if exists trg_activate_existing_invited_staff on public.staff_invitations;
create trigger trg_activate_existing_invited_staff after insert or update of status on public.staff_invitations
for each row execute function public.activate_existing_invited_staff();

-- ---------------------------------------------------------------------
-- 6. Module-level RLS policies (read/write by module)
-- ---------------------------------------------------------------------
drop policy if exists "staff_profiles_read" on public.profiles;
drop policy if exists "staff_merchants_read" on public.merchant_profiles;
drop policy if exists "staff_merchants_update" on public.merchant_profiles;
drop policy if exists "staff_categories_manage" on public.categories;
drop policy if exists "staff_homepage_manage" on public.site_settings;
drop policy if exists "staff_registrations_manage" on public.registration_appointments;
drop policy if exists "staff_campaigns_manage" on public.campaigns;
drop policy if exists "staff_reviews_manage" on public.product_reviews;
drop policy if exists "staff_chats_read" on public.chat_messages;
drop policy if exists "staff_login_history_read" on public.login_history;
drop policy if exists "staff_payments_manage" on public.payments;
drop policy if exists "staff_topups_manage" on public.topup_requests;
drop policy if exists "staff_withdrawals_manage" on public.withdrawal_requests;
drop policy if exists "staff_subscriptions_manage" on public.subscriptions;
drop policy if exists "staff_subscription_requests_manage" on public.subscription_requests;
drop policy if exists "staff_orders_read" on public.orders;
drop policy if exists "staff_order_items_read" on public.order_items;
drop policy if exists "staff_products_read" on public.products;
drop policy if exists "staff_wallet_read" on public.platform_wallet;
drop policy if exists "staff_wallet_transactions_read" on public.platform_wallet_transactions;

create policy "staff_profiles_read" on public.profiles for select to authenticated using (
  public.has_admin_permission('overview') or public.has_admin_permission('merchants') or
  public.has_admin_permission('subscriptions') or public.has_admin_permission('reports') or
  public.has_admin_permission('topups') or public.has_admin_permission('withdrawals') or
  public.has_admin_permission('payments') or public.has_admin_permission('sales') or
  public.has_admin_permission('chats') or public.has_admin_permission('login_history'));
create policy "staff_merchants_read" on public.merchant_profiles for select to authenticated using (
  public.has_admin_permission('overview') or public.has_admin_permission('merchants') or
  public.has_admin_permission('subscriptions') or public.has_admin_permission('reports') or
  public.has_admin_permission('topups') or public.has_admin_permission('withdrawals') or
  public.has_admin_permission('payments') or public.has_admin_permission('sales') or
  public.has_admin_permission('chats'));
create policy "staff_merchants_update" on public.merchant_profiles for update to authenticated using (public.has_admin_permission('merchants') or public.has_admin_permission('subscriptions')) with check (public.has_admin_permission('merchants') or public.has_admin_permission('subscriptions'));
create policy "staff_categories_manage" on public.categories for all to authenticated using (public.has_admin_permission('categories')) with check (public.has_admin_permission('categories'));
create policy "staff_homepage_manage" on public.site_settings for all to authenticated using (public.has_admin_permission('homepage')) with check (public.has_admin_permission('homepage'));
create policy "staff_registrations_manage" on public.registration_appointments for all to authenticated using (public.has_admin_permission('overview') or public.has_admin_permission('registrations')) with check (public.has_admin_permission('registrations'));
create policy "staff_campaigns_manage" on public.campaigns for all to authenticated using (public.has_admin_permission('campaigns')) with check (public.has_admin_permission('campaigns'));
create policy "staff_reviews_manage" on public.product_reviews for all to authenticated using (public.has_admin_permission('reviews')) with check (public.has_admin_permission('reviews'));
create policy "staff_chats_read" on public.chat_messages for select to authenticated using (public.has_admin_permission('chats'));
create policy "staff_login_history_read" on public.login_history for select to authenticated using (public.has_admin_permission('login_history'));
create policy "staff_payments_manage" on public.payments for all to authenticated using (public.has_admin_permission('payments') or public.has_admin_permission('sales') or public.has_admin_permission('reports')) with check (public.has_admin_permission('payments'));
create policy "staff_topups_manage" on public.topup_requests for all to authenticated using (public.has_admin_permission('overview') or public.has_admin_permission('topups') or public.has_admin_permission('reports')) with check (public.has_admin_permission('topups'));
create policy "staff_withdrawals_manage" on public.withdrawal_requests for all to authenticated using (public.has_admin_permission('overview') or public.has_admin_permission('withdrawals') or public.has_admin_permission('reports')) with check (public.has_admin_permission('withdrawals'));
create policy "staff_subscriptions_manage" on public.subscriptions for all to authenticated using (public.has_admin_permission('subscriptions')) with check (public.has_admin_permission('subscriptions'));
create policy "staff_subscription_requests_manage" on public.subscription_requests for all to authenticated using (public.has_admin_permission('overview') or public.has_admin_permission('subscriptions')) with check (public.has_admin_permission('subscriptions'));
create policy "staff_orders_read" on public.orders for select to authenticated using (public.has_admin_permission('overview') or public.has_admin_permission('sales') or public.has_admin_permission('reports') or public.has_admin_permission('payments') or public.has_admin_permission('wallet'));
create policy "staff_order_items_read" on public.order_items for select to authenticated using (public.has_admin_permission('sales') or public.has_admin_permission('reports') or public.has_admin_permission('payments'));
create policy "staff_products_read" on public.products for select to authenticated using (public.has_admin_permission('sales') or public.has_admin_permission('reports'));
create policy "staff_wallet_read" on public.platform_wallet for select to authenticated using (public.has_admin_permission('overview') or public.has_admin_permission('wallet'));
create policy "staff_wallet_transactions_read" on public.platform_wallet_transactions for select to authenticated using (public.has_admin_permission('wallet'));

-- ---------------------------------------------------------------------
-- 7. Storage read policies for staff (business permits, payment proofs)
-- ---------------------------------------------------------------------
drop policy if exists "business_permit_staff_read" on storage.objects;
create policy "business_permit_staff_read" on storage.objects for select to authenticated
using (bucket_id = 'business-permits' and public.has_admin_permission('merchants'));
drop policy if exists "payment_proofs_staff_read" on storage.objects;
create policy "payment_proofs_staff_read" on storage.objects for select to authenticated using (
  bucket_id = 'payment-proofs' and (
    public.has_admin_permission('payments') or public.has_admin_permission('topups') or
    public.has_admin_permission('subscriptions')
  )
);

-- ---------------------------------------------------------------------
-- 8. get_admin_merchant_profiles() — keep merchant access least-privilege
--
-- Drop first: production already has this function returning an extra
-- business_permit_expires_at column (added by 20260730000100/...200), and
-- CREATE OR REPLACE cannot change a function's return columns.
-- ---------------------------------------------------------------------
drop function if exists public.get_admin_merchant_profiles();

create or replace function public.get_admin_merchant_profiles()
returns table (id uuid,business_name text,status public.merchant_status,created_at timestamptz,business_permit_url text,business_permit_status text,business_permit_notes text,business_permit_reviewed_at timestamptz,business_permit_reviewed_by uuid,business_permit_expires_at timestamptz,profile_full_name text,profile_phone text)
language plpgsql security definer set search_path=public as $$ begin
  if not public.has_admin_permission('merchants') then raise exception 'ADMIN_REQUIRED'; end if;
  return query select mp.id,mp.business_name,mp.status,mp.created_at,mp.business_permit_url,mp.business_permit_status,mp.business_permit_notes,mp.business_permit_reviewed_at,mp.business_permit_reviewed_by,mp.business_permit_expires_at,p.full_name,p.phone from public.merchant_profiles mp join public.profiles p on p.id=mp.id order by mp.created_at desc;
end; $$;
grant execute on function public.get_admin_merchant_profiles() to authenticated;

notify pgrst, 'reload schema';
