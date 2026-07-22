-- Admin-created staff invitations and module-level access control.
alter type public.user_role add value if not exists 'staff';

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

alter table public.staff_invitations enable row level security;
alter table public.staff_access enable row level security;

-- Some installations applied the core schema without the optional homepage
-- migration. Create it safely so the Homepage permission can be installed.
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists "site_settings_public_read" on public.site_settings;
create policy "site_settings_public_read" on public.site_settings for select using (true);
drop policy if exists "site_settings_admin_write" on public.site_settings;
create policy "site_settings_admin_write" on public.site_settings for all using (public.is_admin()) with check (public.is_admin());
grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;

create or replace function public.has_admin_permission(p_permission text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
    or coalesce((select active and p_permission = any(permissions) from public.staff_access where user_id = auth.uid()), false);
$$;
revoke all on function public.has_admin_permission(text) from public, anon;
grant execute on function public.has_admin_permission(text) to authenticated;

drop policy if exists "staff_invitations_admin_manage" on public.staff_invitations;
create policy "staff_invitations_admin_manage" on public.staff_invitations for all to authenticated
using (public.is_admin()) with check (public.is_admin());
drop policy if exists "staff_access_admin_manage" on public.staff_access;
create policy "staff_access_admin_manage" on public.staff_access for all to authenticated
using (public.is_admin()) with check (public.is_admin());
drop policy if exists "staff_access_read_own" on public.staff_access;
create policy "staff_access_read_own" on public.staff_access for select to authenticated using (user_id = auth.uid());
grant select, insert, update, delete on public.staff_invitations, public.staff_access to authenticated;

create or replace function public.activate_invited_staff()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare v_invite public.staff_invitations;
begin
  select i.* into v_invite from public.staff_invitations i
  join auth.users u on lower(u.email) = i.email
  where u.id = new.id and i.status = 'pending' limit 1;
  if v_invite.id is null then return new; end if;
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
declare v_user_id uuid;
begin
  if new.status <> 'pending' then return new; end if;
  select id into v_user_id from auth.users where lower(email) = new.email limit 1;
  if v_user_id is null then return new; end if;
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

-- Read/write policies are additive and remain module-specific.
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

-- Private permit files remain available only to staff assigned to Merchants.
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

-- Existing admin RPC/trigger checks remain least-privilege for staff.
create or replace function public.get_admin_merchant_profiles()
returns table (id uuid,business_name text,status public.merchant_status,created_at timestamptz,business_permit_url text,business_permit_status text,business_permit_notes text,business_permit_reviewed_at timestamptz,business_permit_reviewed_by uuid,profile_full_name text,profile_phone text)
language plpgsql security definer set search_path=public as $$ begin
  if not public.has_admin_permission('merchants') then raise exception 'ADMIN_REQUIRED'; end if;
  return query select mp.id,mp.business_name,mp.status,mp.created_at,mp.business_permit_url,mp.business_permit_status,mp.business_permit_notes,mp.business_permit_reviewed_at,mp.business_permit_reviewed_by,p.full_name,p.phone from public.merchant_profiles mp join public.profiles p on p.id=mp.id order by mp.created_at desc;
end; $$;
grant execute on function public.get_admin_merchant_profiles() to authenticated;

create or replace function public.protect_request_review()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if not (public.is_admin() or
    (tg_table_name='topup_requests' and public.has_admin_permission('topups')) or
    (tg_table_name='withdrawal_requests' and public.has_admin_permission('withdrawals')) or
    (tg_table_name='subscription_requests' and public.has_admin_permission('subscriptions'))
  ) then raise exception 'ADMIN_REVIEW_REQUIRED'; end if;
  if old.status <> 'pending' or new.status not in ('approved','rejected') or (to_jsonb(new)-array['status','admin_notes','reviewed_by','reviewed_at'])<>(to_jsonb(old)-array['status','admin_notes','reviewed_by','reviewed_at']) or new.reviewed_by<>auth.uid() or new.reviewed_at is null then raise exception 'INVALID_REVIEW_UPDATE'; end if;
  new.admin_notes := left(new.admin_notes, 1000);
  return new;
end; $$;
