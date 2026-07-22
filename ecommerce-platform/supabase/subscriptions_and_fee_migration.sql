-- =====================================================================
-- Adds: subscriptions (merchant + reseller, admin-controlled, 1-year free
-- grant), and a 10% platform operation fee deducted from the merchant's
-- payout when a reseller's order is completed.
-- Safe to run once on an existing project — every step is idempotent.
-- =====================================================================

-- 1. Subscription status enum + table
do $$ begin
  create type subscription_status as enum ('active', 'expired', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade unique,
  status subscription_status not null default 'active',
  is_free boolean not null default false,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_owner on public.subscriptions(owner_id);
create index if not exists idx_subscriptions_expires on public.subscriptions(expires_at);

alter table public.subscriptions enable row level security;

drop policy if exists "subscription_owner_select" on public.subscriptions;
create policy "subscription_owner_select" on public.subscriptions
  for select using (owner_id = auth.uid() or public.is_admin());
drop policy if exists "subscription_admin_all" on public.subscriptions;
create policy "subscription_admin_all" on public.subscriptions
  for all using (public.is_admin());

-- 2. Grant every existing merchant/reseller a free 1-year subscription
insert into public.subscriptions (owner_id, status, is_free, started_at, expires_at)
select p.id, 'active', true, now(), now() + interval '1 year'
from public.profiles p
where p.role in ('merchant', 'reseller')
on conflict (owner_id) do nothing;

-- 3. New signups get one automatically going forward
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_role user_role;
begin
  begin
    v_role := coalesce(new.raw_user_meta_data->>'role', 'reseller')::user_role;
  exception when others then
    v_role := 'reseller';
  end;

  insert into public.profiles (id, full_name, role, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    v_role,
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;

  if v_role = 'merchant' then
    insert into public.merchant_profiles (id, business_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'business_name', 'My Store'))
    on conflict (id) do nothing;
  else
    insert into public.wallets (owner_id, balance)
    values (new.id, 0)
    on conflict (owner_id) do nothing;
  end if;

  begin
    insert into public.subscriptions (owner_id, status, is_free, started_at, expires_at)
    values (new.id, 'active', true, now(), now() + interval '1 year')
    on conflict (owner_id) do nothing;
  exception when others then null;
  end;

  return new;
end;
$$;

-- 4. platform_fee column on orders
alter table public.orders add column if not exists platform_fee numeric(12,2) not null default 0;

-- 5. Compute the 10% fee (reseller-buyer orders only) before completion,
-- then pay the merchant total-minus-fee on completion.
create or replace function public.compute_order_platform_fee()
returns trigger language plpgsql
security definer set search_path = public
as $$
declare
  v_buyer_role user_role;
begin
  if new.status = 'completed' and old.status in ('confirmed', 'processing', 'shipped') then
    select role into v_buyer_role from public.profiles where id = new.reseller_id;
    if v_buyer_role = 'reseller' then
      new.platform_fee := round(new.total * 0.10, 2);
    else
      new.platform_fee := 0;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_compute_order_fee on public.orders;
create trigger trg_compute_order_fee
  before update on public.orders
  for each row execute function public.compute_order_platform_fee();

create or replace function public.handle_order_status_change()
returns trigger language plpgsql
security definer set search_path = public
as $$
declare
  v_wallet_id uuid;
  v_payout numeric(12,2);
begin
  if new.status = 'completed' and old.status in ('confirmed', 'processing', 'shipped') then
    v_payout := new.total - coalesce(new.platform_fee, 0);

    select id into v_wallet_id from public.wallets where owner_id = new.merchant_id;
    if v_wallet_id is null then
      insert into public.wallets (owner_id, balance) values (new.merchant_id, 0)
      returning id into v_wallet_id;
    end if;
    update public.wallets set balance = balance + v_payout, updated_at = now() where id = v_wallet_id;
    insert into public.wallet_transactions (wallet_id, amount, type, description, order_id)
    values (
      v_wallet_id, v_payout, 'credit',
      'Order ' || new.order_number || ' delivered - payout' ||
      case when coalesce(new.platform_fee, 0) > 0 then ' (10% operation fee deducted: ' || new.platform_fee || ')' else '' end,
      new.id
    );
  end if;

  if new.status = 'cancelled' and old.status in ('confirmed', 'processing', 'shipped') then
    select id into v_wallet_id from public.wallets where owner_id = new.reseller_id;
    if v_wallet_id is not null then
      update public.wallets set balance = balance + new.total, updated_at = now() where id = v_wallet_id;
      insert into public.wallet_transactions (wallet_id, amount, type, description, order_id)
      values (v_wallet_id, new.total, 'credit', 'Order ' || new.order_number || ' cancelled - refund', new.id);
    end if;
  end if;

  return new;
end;
$$;

-- =====================================================================
-- DONE. Subscriptions show up under Admin > Subscriptions; the merchant
-- expiry popup reads from the same table. Completed reseller orders now
-- deduct a 10% platform fee from the merchant's payout automatically.
-- =====================================================================
