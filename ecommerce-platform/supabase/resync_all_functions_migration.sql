-- =====================================================================
-- Force-redeploys every function/trigger body from the current schema.sql,
-- regardless of what's currently live. This closes out the recurring
-- "uuid_generate_v4() does not exist" error for good: fix_uuid_default_migration.sql
-- only fixed column DEFAULTs, but generate_order_number() (and potentially
-- other trigger functions) independently call uuid-generation inside their
-- own body — those were never redeployed after schema.sql was rewritten to
-- use gen_random_uuid(), since CREATE OR REPLACE FUNCTION was never re-run
-- against the live project for them.
--
-- Safe to run anytime — every statement is CREATE OR REPLACE (or DROP...
-- CREATE for triggers), so this is idempotent and non-destructive.
-- =====================================================================

-- generate_order_number (BEFORE INSERT on orders) — the most likely culprit,
-- since it was only ever created once by the very first schema.sql run and
-- never touched by any later migration file.
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

-- handle_new_user (AFTER INSERT on auth.users)
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- handle_merchant_approval (AFTER UPDATE on merchant_profiles)
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

-- handle_payment_verified (AFTER UPDATE on payments)
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

-- handle_topup_approved (AFTER UPDATE on topup_requests)
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

-- touch_updated_at (BEFORE UPDATE on products/orders)
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

-- compute_order_platform_fee (BEFORE UPDATE on orders)
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

-- handle_order_status_change (AFTER UPDATE on orders)
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

drop trigger if exists trg_order_status_change on public.orders;
create trigger trg_order_status_change
  after update on public.orders
  for each row execute function public.handle_order_status_change();

-- lock_order_financials (BEFORE UPDATE on orders)
create or replace function public.lock_order_financials()
returns trigger language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.total is distinct from old.total
       or new.subtotal is distinct from old.subtotal
       or new.shipping_fee is distinct from old.shipping_fee
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

-- handle_withdrawal_reviewed (AFTER UPDATE on withdrawal_requests)
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

-- place_order RPC
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
  v_platform_fee numeric(12,2) := 0;
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
    v_platform_fee := round(v_total * 0.10, 2);
  end if;

  if v_wallet.balance < v_total then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  insert into public.orders (reseller_id, merchant_id, status, subtotal, shipping_fee, total, platform_fee, shipping_address)
  values (v_buyer_id, p_merchant_id, 'confirmed', v_subtotal, coalesce(p_shipping_fee, 0), v_total, v_platform_fee, p_shipping_address)
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
  values (v_wallet.id, v_total, 'debit', 'Payment for order ' || v_order.order_number, v_order.id);

  return v_order;
end;
$$;

grant execute on function public.place_order(uuid, text, jsonb, numeric) to authenticated;

-- request_withdrawal RPC
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

-- Final sanity check: this should return 0 rows.
select n.nspname as schema_name, p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where pg_get_functiondef(p.oid) ilike '%uuid_generate_v4%';
