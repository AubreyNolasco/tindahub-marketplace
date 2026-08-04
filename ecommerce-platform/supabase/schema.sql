-- =====================================================================
-- JOM HUB Marketplace — Full Database Schema for Supabase
-- Run this ONCE on a brand-new Supabase project (SQL Editor > New Query)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. (no extensions needed — gen_random_uuid() is built into Postgres 13+,
-- which avoids uuid-ossp's occasional "function does not exist" issue on
-- projects where it gets installed outside the public schema's search path)
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1. ENUM TYPES
-- ---------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('admin', 'merchant', 'reseller');
exception when duplicate_object then null; end $$;

do $$ begin
  create type merchant_status as enum ('pending', 'approved', 'rejected', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('pending_payment', 'payment_review', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('gcash', 'maya', 'bank_transfer', 'cod');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('pending', 'submitted', 'verified', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type topup_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type subscription_status as enum ('active', 'expired', 'cancelled');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. CORE TABLES
-- ---------------------------------------------------------------------

-- Profiles (1-1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role user_role not null default 'reseller',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Merchant-specific business info
create table if not exists public.merchant_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  business_name text not null,
  business_description text,
  business_address text,
  status merchant_status not null default 'pending',
  trial_ends_at timestamptz default (now() + interval '14 days'),
  subscription_active boolean not null default false,
  subscription_expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- Subscription (one per merchant or reseller — granted free for 1 year on
-- signup, fully managed by admin from there: extend, expire, or cancel)
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

-- Wallet (one per merchant or reseller — merchants get theirs on approval,
-- resellers get theirs immediately on signup)
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade unique,
  balance numeric(12,2) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  amount numeric(12,2) not null,
  type text not null check (type in ('credit', 'debit')),
  description text,
  order_id uuid,
  created_at timestamptz not null default now()
);

-- Platform wallet: receives operation fees from reseller orders and merchants.
create table if not exists public.platform_wallet (
  id boolean primary key default true check (id = true),
  balance numeric(12,2) not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.platform_wallet (id, balance) values (true, 0) on conflict (id) do nothing;

create table if not exists public.platform_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  amount numeric(12,2) not null check (amount > 0),
  type text not null check (type in ('credit', 'debit')),
  description text not null,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Wallet top-up requests (merchant or reseller submits, admin approves/rejects)
create table if not exists public.topup_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  method payment_method not null,
  reference_number text,
  proof_url text,
  status topup_status not null default 'pending',
  admin_notes text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_topup_requests_owner on public.topup_requests(owner_id);
create index if not exists idx_topup_requests_status on public.topup_requests(status);

-- Wallet withdrawal requests (merchant or reseller requests a cash-out to their
-- bank account; wallet is debited immediately on request, refunded if rejected)
create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  bank_name text not null,
  bank_account_name text not null,
  bank_account_number text not null,
  status topup_status not null default 'pending',
  admin_notes text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_withdrawal_requests_owner on public.withdrawal_requests(owner_id);
create index if not exists idx_withdrawal_requests_status on public.withdrawal_requests(status);

-- Categories
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- Products
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchant_profiles(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text,
  sku text,
  price numeric(12,2) not null check (price >= 0),
  wholesale_price numeric(12,2),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  min_order_qty integer not null default 1,
  images text[] default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_merchant on public.products(merchant_id);
create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_products_active on public.products(is_active);

-- Reseller's saved customers (simple CRM)
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

-- Orders
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  reseller_id uuid not null references public.profiles(id) on delete cascade,
  merchant_id uuid not null references public.merchant_profiles(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  status order_status not null default 'pending_payment',
  subtotal numeric(12,2) not null default 0,
  shipping_fee numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  platform_fee numeric(12,2) not null default 0,
  reseller_operation_fee numeric(12,2) not null default 0,
  shipping_address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_reseller on public.orders(reseller_id);
create index if not exists idx_orders_merchant on public.orders(merchant_id);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(12,2) not null,
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null
);

-- Manual payment proof (GCash / Maya screenshot upload)
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  method payment_method not null,
  reference_number text,
  amount numeric(12,2) not null,
  proof_url text,
  status payment_status not null default 'pending',
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- Reseller <-> Merchant chat
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchant_profiles(id) on delete cascade,
  reseller_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_thread on public.chat_messages(merchant_id, reseller_id, created_at);

-- ---------------------------------------------------------------------
-- 3. HELPER FUNCTIONS (SECURITY DEFINER to safely check role w/o RLS recursion)
-- ---------------------------------------------------------------------
create or replace function public.current_user_role()
returns user_role
language sql security definer stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql security definer stable
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------
-- 4. TRIGGERS
-- ---------------------------------------------------------------------

-- 4a. Auto-create profile on signup (reads role + name from user metadata)
-- IMPORTANT: kept minimal & defensive so it can NEVER throw and block signup.
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
    -- Resellers get a wallet right away; merchants get theirs on approval (see trg_merchant_approval)
    insert into public.wallets (owner_id, balance)
    values (new.id, 0)
    on conflict (owner_id) do nothing;
  end if;

  -- Every new merchant or reseller gets a free 1-year subscription.
  -- Wrapped so a missing/broken subscriptions table can never block signup.
  begin
    insert into public.subscriptions (owner_id, status, is_free, started_at, expires_at)
    values (new.id, 'active', true, now(), now() + interval '1 year')
    on conflict (owner_id) do nothing;
  exception when others then null;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4b. Auto-generate order number
create or replace function public.generate_order_number()
returns trigger language plpgsql as $$
begin
  if new.order_number is null then
    new.order_number := 'ORD-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_order_number on public.orders;
create trigger trg_order_number
  before insert on public.orders
  for each row execute function public.generate_order_number();

-- 4c. Auto-create wallet when merchant gets approved
create or replace function public.handle_merchant_approval()
returns trigger language plpgsql as $$
begin
  if new.status = 'approved' and (old.status is distinct from 'approved') then
    insert into public.wallets (owner_id, balance)
    values (new.id, 0)
    on conflict (owner_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_merchant_approval on public.merchant_profiles;
create trigger trg_merchant_approval
  after update on public.merchant_profiles
  for each row execute function public.handle_merchant_approval();

-- 4d. Credit merchant wallet when payment gets verified
create or replace function public.handle_payment_verified()
returns trigger language plpgsql
security definer set search_path = public
as $$
declare
  v_wallet_id uuid;
  v_merchant_id uuid;
begin
  if new.status = 'verified' and (old.status is distinct from 'verified') then
    select merchant_id into v_merchant_id from public.orders where id = new.order_id;
    select id into v_wallet_id from public.wallets where owner_id = v_merchant_id;

    if v_wallet_id is not null then
      update public.wallets set balance = balance + new.amount, updated_at = now() where id = v_wallet_id;
      insert into public.wallet_transactions (wallet_id, amount, type, description, order_id)
      values (v_wallet_id, new.amount, 'credit', 'Payment verified for order', new.order_id);
    end if;

    update public.orders set status = 'confirmed', updated_at = now() where id = new.order_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_payment_verified on public.payments;
create trigger trg_payment_verified
  after update on public.payments
  for each row execute function public.handle_payment_verified();

-- 4e. Credit wallet when a top-up request gets approved by admin
create or replace function public.handle_topup_approved()
returns trigger language plpgsql
security definer set search_path = public
as $$
declare
  v_wallet_id uuid;
begin
  if new.status = 'approved' and (old.status is distinct from 'approved') then
    select id into v_wallet_id from public.wallets where owner_id = new.owner_id;

    if v_wallet_id is null then
      insert into public.wallets (owner_id, balance) values (new.owner_id, 0)
      returning id into v_wallet_id;
    end if;

    update public.wallets set balance = balance + new.amount, updated_at = now() where id = v_wallet_id;
    insert into public.wallet_transactions (wallet_id, amount, type, description)
    values (v_wallet_id, new.amount, 'credit', 'Wallet top-up approved');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_topup_approved on public.topup_requests;
create trigger trg_topup_approved
  after update on public.topup_requests
  for each row execute function public.handle_topup_approved();

-- 4f. keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_products on public.products;
create trigger trg_touch_products before update on public.products
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_orders on public.orders;
create trigger trg_touch_orders before update on public.orders
  for each row execute function public.touch_updated_at();

-- 4g-0. Record the merchant's 5% operation fee when the merchant starts
-- processing a reseller's order. It is deducted from the eventual payout.
create or replace function public.compute_order_platform_fee()
returns trigger language plpgsql
security definer set search_path = public
as $$
declare
  v_buyer_role user_role;
  v_wallet_id uuid;
  v_fee numeric(12,2);
begin
  if new.status = 'processing' and old.status = 'confirmed' then
    select role into v_buyer_role from public.profiles where id = new.reseller_id;
    if v_buyer_role = 'reseller' then
      v_fee := round((new.total - coalesce(new.reseller_operation_fee, 0)) * 0.05, 2);
      select id into v_wallet_id from public.wallets where owner_id = new.merchant_id for update;
      if v_wallet_id is null then
        raise exception 'NO_MERCHANT_WALLET';
      end if;
      if (select balance from public.wallets where id = v_wallet_id) < v_fee then
        raise exception 'INSUFFICIENT_MERCHANT_FEE_BALANCE';
      end if;
      update public.wallets set balance = balance - v_fee, updated_at = now() where id = v_wallet_id;
      insert into public.wallet_transactions (wallet_id, amount, type, description, order_id)
      values (v_wallet_id, v_fee, 'debit', 'Order ' || new.order_number || ' — 5% merchant operation fee charged on processing', new.id);
      update public.platform_wallet set balance = balance + v_fee, updated_at = now() where id = true;
      insert into public.platform_wallet_transactions (amount, type, description, order_id)
      values (v_fee, 'credit', '5% merchant operation fee — order ' || new.order_number, new.id);
      new.platform_fee := v_fee;
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

-- 4g. Escrow release: credit the merchant (minus the platform fee) when the
-- buyer confirms delivery, refund the buyer if a paid order is cancelled
-- before delivery
create or replace function public.handle_order_status_change()
returns trigger language plpgsql
security definer set search_path = public
as $$
declare
  v_wallet_id uuid;
  v_payout numeric(12,2);
begin
  if new.status = 'completed' and old.status in ('confirmed', 'processing', 'shipped') then
    v_payout := new.total - coalesce(new.reseller_operation_fee, 0);

    select id into v_wallet_id from public.wallets where owner_id = new.merchant_id;
    if v_wallet_id is null then
      insert into public.wallets (owner_id, balance) values (new.merchant_id, 0)
      returning id into v_wallet_id;
    end if;
    update public.wallets set balance = balance + v_payout, updated_at = now() where id = v_wallet_id;
    insert into public.wallet_transactions (wallet_id, amount, type, description, order_id)
    values (
      v_wallet_id, v_payout, 'credit',
      'Order ' || new.order_number || ' payout — product amount: ' ||
      (new.total - coalesce(new.reseller_operation_fee, 0)) ||
      '; merchant operation fee charged separately: ' || coalesce(new.platform_fee, 0) ||
      '; payout: ' || v_payout,
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

drop trigger if exists trg_order_status_change on public.orders;
create trigger trg_order_status_change
  after update on public.orders
  for each row execute function public.handle_order_status_change();

-- 4g-2. Freeze the money fields (and buyer/seller identity) on an order after
-- creation for non-admins. Without this, RLS would otherwise let either party
-- inflate `total` before triggering a completion/cancellation, since the
-- payout/refund triggers above trust `new.total`.
create or replace function public.lock_order_financials()
returns trigger language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.total is distinct from old.total
       or new.subtotal is distinct from old.subtotal
       or new.shipping_fee is distinct from old.shipping_fee
       or new.reseller_operation_fee is distinct from old.reseller_operation_fee
       or new.reseller_id is distinct from old.reseller_id
       or new.merchant_id is distinct from old.merchant_id then
      raise exception 'ORDER_FINANCIALS_LOCKED';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lock_order_financials on public.orders;
create trigger trg_lock_order_financials
  before update on public.orders
  for each row execute function public.lock_order_financials();

-- 4h. Refund the wallet if a withdrawal request gets rejected
-- (funds are debited up-front when the request is submitted — see request_withdrawal())
create or replace function public.handle_withdrawal_reviewed()
returns trigger language plpgsql
security definer set search_path = public
as $$
declare
  v_wallet_id uuid;
begin
  if new.status = 'rejected' and old.status = 'pending' then
    select id into v_wallet_id from public.wallets where owner_id = new.owner_id;
    if v_wallet_id is not null then
      update public.wallets set balance = balance + new.amount, updated_at = now() where id = v_wallet_id;
      insert into public.wallet_transactions (wallet_id, amount, type, description)
      values (v_wallet_id, new.amount, 'credit', 'Withdrawal request rejected - refund');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_withdrawal_reviewed on public.withdrawal_requests;
create trigger trg_withdrawal_reviewed
  after update on public.withdrawal_requests
  for each row execute function public.handle_withdrawal_reviewed();

-- ---------------------------------------------------------------------
-- 4i. RPC FUNCTIONS (called from the client via supabase.rpc(...))
-- ---------------------------------------------------------------------

-- Atomically places an order: validates items/stock/price against live product
-- data (never trusts client-supplied prices), then debits the buyer's wallet.
-- Raises an exception (caught as an error on the client) if the cart is invalid
-- or the wallet balance is insufficient — nothing is written on failure.
create or replace function public.place_order(
  p_merchant_id uuid,
  p_shipping_address text,
  p_items jsonb,
  p_shipping_fee numeric default 0
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid := auth.uid();
  v_item jsonb;
  v_product record;
  v_quantity integer;
  v_line_total numeric(12,2);
  v_subtotal numeric(12,2) := 0;
  v_total numeric(12,2);
  v_reseller_operation_fee numeric(12,2) := 0;
  v_buyer_role user_role;
  v_wallet record;
  v_order public.orders;
begin
  if v_buyer_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  select * into v_wallet from public.wallets where owner_id = v_buyer_id for update;
  if v_wallet is null then
    raise exception 'NO_WALLET';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;

    select id, name, price, stock_quantity, min_order_qty, merchant_id, is_active
      into v_product
      from public.products
      where id = (v_item->>'product_id')::uuid
      for update;

    if v_product is null or v_product.merchant_id <> p_merchant_id or v_product.is_active = false then
      raise exception 'PRODUCT_UNAVAILABLE';
    end if;
    if v_quantity < v_product.min_order_qty then
      raise exception 'BELOW_MIN_ORDER_QTY';
    end if;
    if v_product.stock_quantity < v_quantity then
      raise exception 'INSUFFICIENT_STOCK';
    end if;

    v_line_total := v_product.price * v_quantity;
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  v_total := v_subtotal + coalesce(p_shipping_fee, 0);
  select role into v_buyer_role from public.profiles where id = v_buyer_id;
  if v_buyer_role = 'reseller' then
    v_reseller_operation_fee := round(v_total * 0.05, 2);
    v_total := v_total + v_reseller_operation_fee;
  end if;

  if v_wallet.balance < v_total then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  insert into public.orders (reseller_id, merchant_id, status, subtotal, shipping_fee, total, reseller_operation_fee, shipping_address)
  values (v_buyer_id, p_merchant_id, 'confirmed', v_subtotal, coalesce(p_shipping_fee, 0), v_total, v_reseller_operation_fee, p_shipping_address)
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    select id, name, price into v_product from public.products where id = (v_item->>'product_id')::uuid;

    insert into public.order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
    values (v_order.id, v_product.id, v_product.name, v_product.price, v_quantity, v_product.price * v_quantity);

    update public.products set stock_quantity = stock_quantity - v_quantity where id = v_product.id;
  end loop;

  update public.wallets set balance = balance - v_total, updated_at = now() where id = v_wallet.id;
  insert into public.wallet_transactions (wallet_id, amount, type, description, order_id)
  values (
    v_wallet.id, v_total, 'debit',
    'Order ' || v_order.order_number || ' payment — product amount: ' ||
    (v_total - v_reseller_operation_fee) || '; 5% reseller fee: ' ||
    v_reseller_operation_fee || '; total charged: ' || v_total,
    v_order.id
  );
  if v_reseller_operation_fee > 0 then
    update public.platform_wallet set balance = balance + v_reseller_operation_fee, updated_at = now() where id = true;
    insert into public.platform_wallet_transactions (amount, type, description, order_id)
    values (v_reseller_operation_fee, 'credit', '5% reseller operation fee — order ' || v_order.order_number, v_order.id);
  end if;

  return v_order;
end;
$$;

grant execute on function public.place_order(uuid, text, jsonb, numeric) to authenticated;

-- Atomically requests a wallet withdrawal: debits the wallet immediately
-- (held pending review) and creates the request for admin approval.
create or replace function public.request_withdrawal(
  p_amount numeric,
  p_bank_name text,
  p_bank_account_name text,
  p_bank_account_number text
)
returns public.withdrawal_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_wallet record;
  v_request public.withdrawal_requests;
begin
  if v_owner_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  select * into v_wallet from public.wallets where owner_id = v_owner_id for update;
  if v_wallet is null or v_wallet.balance < p_amount then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  update public.wallets set balance = balance - p_amount, updated_at = now() where id = v_wallet.id;

  insert into public.withdrawal_requests (owner_id, amount, bank_name, bank_account_name, bank_account_number, status)
  values (v_owner_id, p_amount, p_bank_name, p_bank_account_name, p_bank_account_number, 'pending')
  returning * into v_request;

  insert into public.wallet_transactions (wallet_id, amount, type, description)
  values (v_wallet.id, p_amount, 'debit', 'Withdrawal request pending (' || v_request.id || ')');

  return v_request;
end;
$$;

grant execute on function public.request_withdrawal(numeric, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.merchant_profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.topup_requests enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.subscriptions enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.chat_messages enable row level security;

-- PROFILES
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());
create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin());

-- MERCHANT PROFILES
create policy "merchant_profile_public_read_approved" on public.merchant_profiles
  for select using (status = 'approved' or id = auth.uid() or public.is_admin());
create policy "merchant_profile_owner_update" on public.merchant_profiles
  for update using (id = auth.uid());
create policy "merchant_profile_admin_all" on public.merchant_profiles
  for all using (public.is_admin());
create policy "merchant_profile_owner_insert" on public.merchant_profiles
  for insert with check (id = auth.uid());

-- WALLETS (owner sees own only, admin sees all)
create policy "wallet_owner_select" on public.wallets
  for select using (owner_id = auth.uid() or public.is_admin());
create policy "wallet_admin_all" on public.wallets
  for all using (public.is_admin());

create policy "wallet_tx_owner_select" on public.wallet_transactions
  for select using (
    exists (select 1 from public.wallets w where w.id = wallet_id and w.owner_id = auth.uid())
    or public.is_admin()
  );
create policy "wallet_tx_admin_all" on public.wallet_transactions
  for all using (public.is_admin());

-- TOPUP REQUESTS (owner submits + reads own, admin reviews all)
create policy "topup_owner_select" on public.topup_requests
  for select using (owner_id = auth.uid() or public.is_admin());
create policy "topup_owner_insert" on public.topup_requests
  for insert with check (owner_id = auth.uid());
create policy "topup_admin_update" on public.topup_requests
  for update using (public.is_admin());

-- WITHDRAWAL REQUESTS (owner reads own, admin reviews all — inserts only via
-- request_withdrawal() RPC, which bypasses RLS, so the wallet debit can never
-- be skipped by writing the row directly)
create policy "withdrawal_owner_select" on public.withdrawal_requests
  for select using (owner_id = auth.uid() or public.is_admin());
create policy "withdrawal_admin_update" on public.withdrawal_requests
  for update using (public.is_admin());

-- SUBSCRIPTIONS (owner can only view their own; fully managed by admin)
create policy "subscription_owner_select" on public.subscriptions
  for select using (owner_id = auth.uid() or public.is_admin());
create policy "subscription_admin_all" on public.subscriptions
  for all using (public.is_admin());

-- CATEGORIES (public read, admin write)
create policy "categories_public_read" on public.categories for select using (true);
create policy "categories_admin_write" on public.categories for all using (public.is_admin());

-- PRODUCTS
create policy "products_public_read_active" on public.products
  for select using (is_active = true or merchant_id = auth.uid() or public.is_admin());
create policy "products_merchant_insert" on public.products
  for insert with check (merchant_id = auth.uid());
create policy "products_merchant_update" on public.products
  for update using (merchant_id = auth.uid() or public.is_admin());
create policy "products_merchant_delete" on public.products
  for delete using (merchant_id = auth.uid() or public.is_admin());

-- CUSTOMERS (reseller CRM — private to reseller)
create policy "customers_owner_all" on public.customers
  for all using (reseller_id = auth.uid() or public.is_admin());

-- ORDERS (reseller who placed it, merchant who receives it, or admin)
create policy "orders_participant_select" on public.orders
  for select using (reseller_id = auth.uid() or merchant_id = auth.uid() or public.is_admin());
create policy "orders_reseller_insert" on public.orders
  for insert with check (reseller_id = auth.uid());
-- Buyer can update their own order (incl. confirming delivery -> 'completed', which
-- releases escrowed funds to the merchant via trg_order_status_change)
create policy "orders_reseller_update" on public.orders
  for update using (reseller_id = auth.uid())
  with check (reseller_id = auth.uid());
-- Merchant can advance their own order up to 'shipped', but can never set it to
-- 'completed' themselves — that would let them release their own escrowed payout
-- without the buyer ever confirming delivery.
create policy "orders_merchant_update" on public.orders
  for update using (merchant_id = auth.uid())
  with check (merchant_id = auth.uid() and status <> 'completed');
create policy "orders_admin_update" on public.orders
  for update using (public.is_admin());

-- ORDER ITEMS
create policy "order_items_participant_select" on public.order_items
  for select using (
    exists (select 1 from public.orders o where o.id = order_id
            and (o.reseller_id = auth.uid() or o.merchant_id = auth.uid() or public.is_admin()))
  );
create policy "order_items_reseller_insert" on public.order_items
  for insert with check (
    exists (select 1 from public.orders o where o.id = order_id and o.reseller_id = auth.uid())
  );

-- PAYMENTS
create policy "payments_participant_select" on public.payments
  for select using (
    exists (select 1 from public.orders o where o.id = order_id
            and (o.reseller_id = auth.uid() or o.merchant_id = auth.uid() or public.is_admin()))
  );
create policy "payments_reseller_insert" on public.payments
  for insert with check (
    exists (select 1 from public.orders o where o.id = order_id and o.reseller_id = auth.uid())
  );
create policy "payments_admin_update" on public.payments
  for update using (public.is_admin() or exists (
    select 1 from public.orders o where o.id = order_id and o.merchant_id = auth.uid()
  ));

-- CHAT MESSAGES
create policy "chat_participant_select" on public.chat_messages
  for select using (reseller_id = auth.uid() or merchant_id = auth.uid() or public.is_admin());
create policy "chat_participant_insert" on public.chat_messages
  for insert with check (sender_id = auth.uid() and (reseller_id = auth.uid() or merchant_id = auth.uid()));
create policy "chat_participant_update" on public.chat_messages
  for update using (reseller_id = auth.uid() or merchant_id = auth.uid());

-- ---------------------------------------------------------------------
-- 6. REALTIME (live chat updates)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 7. STORAGE BUCKETS (product images + payment/top-up proofs)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

create policy "product_images_public_read" on storage.objects
  for select using (bucket_id = 'product-images');
create policy "product_images_merchant_write" on storage.objects
  for insert with check (bucket_id = 'product-images' and auth.uid() is not null);
create policy "product_images_merchant_delete" on storage.objects
  for delete using (bucket_id = 'product-images' and owner = auth.uid());

create policy "payment_proofs_owner_write" on storage.objects
  for insert with check (bucket_id = 'payment-proofs' and auth.uid() is not null);
create policy "payment_proofs_owner_read" on storage.objects
  for select using (bucket_id = 'payment-proofs' and (owner = auth.uid() or public.is_admin()));

-- ---------------------------------------------------------------------
-- 8. SEED DATA (sample categories so the catalog isn't empty)
-- ---------------------------------------------------------------------
insert into public.categories (name, slug) values
  ('Grocery & Food', 'grocery-food'),
  ('Health & Beauty', 'health-beauty'),
  ('Home & Living', 'home-living'),
  ('Fashion & Apparel', 'fashion-apparel'),
  ('Electronics & Gadgets', 'electronics-gadgets'),
  ('Baby & Kids', 'baby-kids')
on conflict (slug) do nothing;

-- =====================================================================
-- DONE. Next: create your first Admin user, then run make_admin.sql
-- =====================================================================
