-- =====================================================================
-- Removes the shipping fee from checkout. The app now always passes 0
-- explicitly, but this updates the RPC's default too for anyone calling
-- place_order() directly without the parameter.
-- Safe to run once — idempotent (CREATE OR REPLACE).
-- =====================================================================

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
