-- =====================================================================
-- Wallet-based checkout + escrow payout + merchant withdrawals.
--
-- REQUIRES: schema.sql (or topup_wallet_migration.sql) already applied,
-- i.e. public.wallets uses owner_id and public.topup_requests exists.
--
-- After this runs:
--  - Checkout debits the buyer's wallet instantly (no more GCash/Maya proof).
--  - Funds sit in escrow until the buyer marks the order 'completed'
--    (Confirm Received) — only then is the merchant's wallet credited.
--  - Cancelling a paid order refunds the buyer.
--  - Merchants can request a withdrawal to their bank account; the wallet
--    is debited immediately (held), and refunded automatically if an admin
--    rejects the request.
--
-- Safe to run once on an existing project — every step is idempotent.
-- =====================================================================

-- 1. Withdrawal requests table
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

alter table public.withdrawal_requests enable row level security;

drop policy if exists "withdrawal_owner_select" on public.withdrawal_requests;
create policy "withdrawal_owner_select" on public.withdrawal_requests
  for select using (owner_id = auth.uid() or public.is_admin());
drop policy if exists "withdrawal_admin_update" on public.withdrawal_requests;
create policy "withdrawal_admin_update" on public.withdrawal_requests
  for update using (public.is_admin());

-- 2. Escrow release / refund trigger on orders
create or replace function public.handle_order_status_change()
returns trigger language plpgsql
security definer set search_path = public
as $$
declare
  v_wallet_id uuid;
begin
  if new.status = 'completed' and old.status in ('confirmed', 'processing', 'shipped') then
    select id into v_wallet_id from public.wallets where owner_id = new.merchant_id;
    if v_wallet_id is null then
      insert into public.wallets (owner_id, balance) values (new.merchant_id, 0)
      returning id into v_wallet_id;
    end if;
    update public.wallets set balance = balance + new.total, updated_at = now() where id = v_wallet_id;
    insert into public.wallet_transactions (wallet_id, amount, type, description, order_id)
    values (v_wallet_id, new.total, 'credit', 'Order ' || new.order_number || ' delivered - payout', new.id);
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

-- 2b. Freeze money fields + buyer/seller identity on an order after creation
-- (for non-admins) so the payout/refund triggers above can trust new.total.
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

-- 3. Withdrawal review trigger (refund on reject)
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

-- 4. place_order RPC — atomic wallet-debit checkout
create or replace function public.place_order(
  p_merchant_id uuid,
  p_shipping_address text,
  p_items jsonb,
  p_shipping_fee numeric default 100
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

  if v_wallet.balance < v_total then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  insert into public.orders (reseller_id, merchant_id, status, subtotal, shipping_fee, total, shipping_address)
  values (v_buyer_id, p_merchant_id, 'confirmed', v_subtotal, coalesce(p_shipping_fee, 0), v_total, p_shipping_address)
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

-- 5. request_withdrawal RPC — atomic wallet-debit withdrawal request
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

-- 6. Tighten orders update policy: only the buyer (or admin) may set an order to
-- 'completed'. Merchants can advance up to 'shipped' but never self-complete —
-- that would let them release their own escrowed payout without buyer confirmation.
drop policy if exists "orders_participant_update" on public.orders;
drop policy if exists "orders_reseller_update" on public.orders;
create policy "orders_reseller_update" on public.orders
  for update using (reseller_id = auth.uid())
  with check (reseller_id = auth.uid());

drop policy if exists "orders_merchant_update" on public.orders;
create policy "orders_merchant_update" on public.orders
  for update using (merchant_id = auth.uid())
  with check (merchant_id = auth.uid() and status <> 'completed');

drop policy if exists "orders_admin_update" on public.orders;
create policy "orders_admin_update" on public.orders
  for update using (public.is_admin());

-- =====================================================================
-- DONE. Withdrawal requests show up in Admin > Mga Withdrawal.
-- Merchants can no longer mark their own orders 'completed' — only the
-- buyer's "Confirm Received" action (or an admin) can do that now.
-- =====================================================================
