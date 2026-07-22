-- =====================================================================

alter table public.orders
  add column if not exists reseller_operation_fee numeric(12,2) not null default 0;
-- Minimal fix: only the two functions checkout actually depends on.
-- Run this if the full resync_all_functions_migration.sql script errors
-- with something unrelated (e.g. "array_agg is an aggregate function") —
-- that's very likely the SQL editor choking on the large multi-statement
-- paste, not the SQL itself. This smaller script narrows it down.
-- =====================================================================

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

  return v_order;
end;
$$;

grant execute on function public.place_order(uuid, text, jsonb, numeric) to authenticated;

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
      if v_wallet_id is null then
        raise exception 'NO_MERCHANT_WALLET';
      end if;
      if (select balance from public.wallets where id = v_wallet_id) < v_fee then
        raise exception 'INSUFFICIENT_MERCHANT_FEE_BALANCE';
      end if;
      update public.wallets set balance = balance - v_fee, updated_at = now() where id = v_wallet_id;
      insert into public.wallet_transactions (wallet_id, amount, type, description, order_id)
      values (v_wallet_id, v_fee, 'debit', 'Order ' || new.order_number || ' — 5% merchant operation fee charged on processing', new.id);
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

create or replace function public.handle_order_status_change()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_wallet_id uuid;
  v_payout numeric(12,2);
begin
  if new.status = 'completed' and old.status in ('confirmed', 'processing', 'shipped') then
    v_payout := new.total - coalesce(new.reseller_operation_fee, 0);
    select id into v_wallet_id from public.wallets where owner_id = new.merchant_id;
    if v_wallet_id is null then
      insert into public.wallets (owner_id, balance) values (new.merchant_id, 0) returning id into v_wallet_id;
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
create trigger trg_order_status_change after update on public.orders
  for each row execute function public.handle_order_status_change();

create or replace function public.lock_order_financials()
returns trigger language plpgsql security definer set search_path = public
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
create trigger trg_lock_order_financials before update on public.orders
  for each row execute function public.lock_order_financials();
