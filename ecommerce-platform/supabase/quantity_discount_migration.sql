-- Quantity-based unit prices. Run after the current JOM HUB schema/migrations.
alter table public.products add column if not exists discount_tiers jsonb not null default '[]'::jsonb;

create or replace function public.validate_discount_tiers()
returns trigger language plpgsql set search_path = public as $$
declare v_tier jsonb; v_qty integer; v_price numeric; v_seen integer[] := '{}';
begin
  if jsonb_typeof(new.discount_tiers) <> 'array' or jsonb_array_length(new.discount_tiers) > 20 then raise exception 'INVALID_DISCOUNT_TIERS'; end if;
  for v_tier in select * from jsonb_array_elements(new.discount_tiers) loop
    begin v_qty := (v_tier->>'min_qty')::integer; v_price := (v_tier->>'price')::numeric;
    exception when others then raise exception 'INVALID_DISCOUNT_TIER'; end;
    if v_qty < 2 or v_price <= 0 or v_price >= new.price or v_qty = any(v_seen) then raise exception 'INVALID_DISCOUNT_TIER'; end if;
    v_seen := array_append(v_seen, v_qty);
  end loop;
  return new;
end; $$;
drop trigger if exists trg_validate_discount_tiers on public.products;
create trigger trg_validate_discount_tiers before insert or update of price, discount_tiers on public.products for each row execute function public.validate_discount_tiers();

create or replace function public.product_unit_price(p_product_id uuid, p_quantity integer)
returns numeric language sql stable security definer set search_path = public as $$
  select least(p.price, coalesce((select min((tier->>'price')::numeric) from jsonb_array_elements(p.discount_tiers) tier where (tier->>'min_qty')::integer <= p_quantity), p.price))
  from public.products p where p.id = p_product_id;
$$;

create or replace function public.place_order(p_merchant_id uuid, p_shipping_address text, p_items jsonb, p_shipping_fee numeric default 0)
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  v_buyer_id uuid := auth.uid(); v_item jsonb; v_product record; v_quantity integer;
  v_unit_price numeric(12,2); v_line_total numeric(12,2); v_subtotal numeric(12,2) := 0;
  v_total numeric(12,2); v_reseller_operation_fee numeric(12,2) := 0;
  v_buyer_role user_role; v_wallet record; v_order public.orders;
begin
  if v_buyer_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then raise exception 'EMPTY_CART'; end if;
  select * into v_wallet from public.wallets where owner_id = v_buyer_id for update;
  if v_wallet is null then raise exception 'NO_WALLET'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    begin v_quantity := (v_item->>'quantity')::integer; exception when others then raise exception 'INVALID_QUANTITY'; end;
    if v_quantity <= 0 then raise exception 'INVALID_QUANTITY'; end if;
    select id, name, price, discount_tiers, stock_quantity, min_order_qty, merchant_id, is_active into v_product
      from public.products where id = (v_item->>'product_id')::uuid for update;
    if v_product is null or v_product.merchant_id <> p_merchant_id or not v_product.is_active then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    if v_quantity < v_product.min_order_qty then raise exception 'BELOW_MIN_ORDER_QTY'; end if;
    if v_product.stock_quantity < v_quantity then raise exception 'INSUFFICIENT_STOCK'; end if;
    v_unit_price := public.product_unit_price(v_product.id, v_quantity);
    v_subtotal := v_subtotal + (v_unit_price * v_quantity);
  end loop;

  v_total := v_subtotal + coalesce(p_shipping_fee, 0);
  select role into v_buyer_role from public.profiles where id = v_buyer_id;
  if v_buyer_role = 'reseller' then v_reseller_operation_fee := round(v_total * 0.05, 2); v_total := v_total + v_reseller_operation_fee; end if;
  if v_wallet.balance < v_total then raise exception 'INSUFFICIENT_BALANCE'; end if;

  insert into public.orders (reseller_id, merchant_id, status, subtotal, shipping_fee, total, reseller_operation_fee, shipping_address)
  values (v_buyer_id, p_merchant_id, 'confirmed', v_subtotal, coalesce(p_shipping_fee, 0), v_total, v_reseller_operation_fee, left(trim(p_shipping_address), 1000)) returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_quantity := (v_item->>'quantity')::integer;
    select id, name into v_product from public.products where id = (v_item->>'product_id')::uuid;
    v_unit_price := public.product_unit_price(v_product.id, v_quantity);
    insert into public.order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
    values (v_order.id, v_product.id, v_product.name, v_unit_price, v_quantity, v_unit_price * v_quantity);
    update public.products set stock_quantity = stock_quantity - v_quantity where id = v_product.id;
  end loop;

  update public.wallets set balance = balance - v_total, updated_at = now() where id = v_wallet.id;
  insert into public.wallet_transactions (wallet_id, amount, type, description, order_id) values (v_wallet.id, v_total, 'debit', 'Payment for order ' || v_order.order_number, v_order.id);
  if v_reseller_operation_fee > 0 then
    update public.platform_wallet set balance = balance + v_reseller_operation_fee, updated_at = now() where id = true;
    insert into public.platform_wallet_transactions (amount, type, description, order_id) values (v_reseller_operation_fee, 'credit', '5% reseller operation fee - order ' || v_order.order_number, v_order.id);
  end if;
  return v_order;
end; $$;
revoke all on function public.place_order(uuid, text, jsonb, numeric) from public, anon;
grant execute on function public.place_order(uuid, text, jsonb, numeric) to authenticated;
