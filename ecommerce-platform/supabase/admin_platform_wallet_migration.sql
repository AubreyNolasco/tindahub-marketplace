-- Admin/platform wallet for the 5% reseller and merchant operation fees.
-- Run this once in Supabase SQL Editor after the existing migrations.

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

alter table public.orders add column if not exists reseller_operation_fee numeric(12,2) not null default 0;
alter table public.orders add column if not exists platform_fee numeric(12,2) not null default 0;

-- On Confirmed -> Processing, debit the merchant's separate 5% fee and
-- immediately credit it to the admin wallet.
create or replace function public.compute_order_platform_fee()
returns trigger language plpgsql security definer set search_path = public
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
      if v_wallet_id is null then raise exception 'NO_MERCHANT_WALLET'; end if;
      if (select balance from public.wallets where id = v_wallet_id) < v_fee then
        raise exception 'INSUFFICIENT_MERCHANT_FEE_BALANCE';
      end if;
      update public.wallets set balance = balance - v_fee, updated_at = now() where id = v_wallet_id;
      insert into public.wallet_transactions (wallet_id, amount, type, description, order_id)
      values (v_wallet_id, v_fee, 'debit', 'Order ' || new.order_number || ' - 5% merchant operation fee', new.id);
      update public.platform_wallet set balance = balance + v_fee, updated_at = now() where id = true;
      insert into public.platform_wallet_transactions (amount, type, description, order_id)
      values (v_fee, 'credit', '5% merchant operation fee - order ' || new.order_number, new.id);
      new.platform_fee := v_fee;
    else
      new.platform_fee := 0;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_compute_order_fee on public.orders;
create trigger trg_compute_order_fee before update on public.orders
  for each row execute function public.compute_order_platform_fee();

-- On completion, release the product amount to the merchant wallet. The 5%
-- reseller fee was already sent to the admin wallet at checkout.
create or replace function public.handle_order_status_change()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_wallet_id uuid; v_payout numeric(12,2);
begin
  if new.status = 'completed' and old.status in ('confirmed', 'processing', 'shipped') then
    v_payout := new.total - coalesce(new.reseller_operation_fee, 0);
    select id into v_wallet_id from public.wallets where owner_id = new.merchant_id;
    if v_wallet_id is null then
      insert into public.wallets (owner_id, balance) values (new.merchant_id, 0) returning id into v_wallet_id;
    end if;
    update public.wallets set balance = balance + v_payout, updated_at = now() where id = v_wallet_id;
    insert into public.wallet_transactions (wallet_id, amount, type, description, order_id)
    values (v_wallet_id, v_payout, 'credit', 'Order ' || new.order_number || ' completed - product payout', new.id);
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
create trigger trg_order_status_change after update on public.orders
  for each row execute function public.handle_order_status_change();

-- Checkout debits the reseller's wallet by the product amount plus 5%, then
-- posts that reseller fee to the admin wallet in the same transaction.
create or replace function public.place_order(
  p_merchant_id uuid, p_shipping_address text, p_items jsonb, p_shipping_fee numeric default 0
)
returns public.orders language plpgsql security definer set search_path = public
as $$
declare
  v_buyer_id uuid := auth.uid(); v_item jsonb; v_product record; v_quantity integer;
  v_subtotal numeric(12,2) := 0; v_total numeric(12,2); v_reseller_fee numeric(12,2) := 0;
  v_buyer_role user_role; v_wallet record; v_order public.orders;
begin
  if v_buyer_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'EMPTY_CART'; end if;
  select * into v_wallet from public.wallets where owner_id = v_buyer_id for update;
  if v_wallet is null then raise exception 'NO_WALLET'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_quantity := (v_item->>'quantity')::integer;
    select id, name, price, stock_quantity, min_order_qty, merchant_id, is_active into v_product
      from public.products where id = (v_item->>'product_id')::uuid for update;
    if v_product is null or v_product.merchant_id <> p_merchant_id or v_product.is_active = false then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    if v_quantity < v_product.min_order_qty then raise exception 'BELOW_MIN_ORDER_QTY'; end if;
    if v_product.stock_quantity < v_quantity then raise exception 'INSUFFICIENT_STOCK'; end if;
    v_subtotal := v_subtotal + (v_product.price * v_quantity);
  end loop;

  v_total := v_subtotal + coalesce(p_shipping_fee, 0);
  select role into v_buyer_role from public.profiles where id = v_buyer_id;
  if v_buyer_role = 'reseller' then
    v_reseller_fee := round(v_total * 0.05, 2);
    v_total := v_total + v_reseller_fee;
  end if;
  if v_wallet.balance < v_total then raise exception 'INSUFFICIENT_BALANCE'; end if;

  insert into public.orders (reseller_id, merchant_id, status, subtotal, shipping_fee, total, reseller_operation_fee, shipping_address)
  values (v_buyer_id, p_merchant_id, 'confirmed', v_subtotal, coalesce(p_shipping_fee, 0), v_total, v_reseller_fee, p_shipping_address)
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_quantity := (v_item->>'quantity')::integer;
    select id, name, price into v_product from public.products where id = (v_item->>'product_id')::uuid;
    insert into public.order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
    values (v_order.id, v_product.id, v_product.name, v_product.price, v_quantity, v_product.price * v_quantity);
    update public.products set stock_quantity = stock_quantity - v_quantity where id = v_product.id;
  end loop;

  update public.wallets set balance = balance - v_total, updated_at = now() where id = v_wallet.id;
  insert into public.wallet_transactions (wallet_id, amount, type, description, order_id)
  values (v_wallet.id, v_total, 'debit', 'Order ' || v_order.order_number || ' payment - product: ' || (v_total - v_reseller_fee) || '; 5% reseller fee: ' || v_reseller_fee, v_order.id);
  if v_reseller_fee > 0 then
    update public.platform_wallet set balance = balance + v_reseller_fee, updated_at = now() where id = true;
    insert into public.platform_wallet_transactions (amount, type, description, order_id)
    values (v_reseller_fee, 'credit', '5% reseller operation fee - order ' || v_order.order_number, v_order.id);
  end if;
  return v_order;
end;
$$;

grant execute on function public.place_order(uuid, text, jsonb, numeric) to authenticated;

alter table public.platform_wallet enable row level security;
alter table public.platform_wallet_transactions enable row level security;
drop policy if exists "platform_wallet_admin_select" on public.platform_wallet;
create policy "platform_wallet_admin_select" on public.platform_wallet for select using (public.is_admin());
drop policy if exists "platform_wallet_transactions_admin_select" on public.platform_wallet_transactions;
create policy "platform_wallet_transactions_admin_select" on public.platform_wallet_transactions for select using (public.is_admin());
