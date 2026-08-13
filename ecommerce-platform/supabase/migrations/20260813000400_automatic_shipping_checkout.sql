-- =====================================================================
-- Phase 4/5 of the address/PSGC/shipping refactor: automatic,
-- distance-based shipping fee at checkout, folded into the same
-- prepaid wallet total as subtotal + processing fee (client's confirmed
-- Decision A). The client also confirmed the merchant-proposes /
-- reseller-accepts negotiation (propose_order_shipping_fee /
-- respond_order_shipping_fee, 20260722000900_shipping_fee_confirmation.sql)
-- should no longer be the default path.
--
-- Design: place_order() tries to compute a real fee from
-- haversine_km(merchant pickup, delivery pin) + calculate_standard_shipping().
-- If it can (both pins exist, products have package dimensions, the
-- order isn't oversized) the order is charged shipping_fee up front —
-- shipping_payment_method becomes 'prepaid_wallet' and it's included in
-- the same wallet debit as everything else, in the same transaction.
-- If it can't (missing pin, missing package info, oversized order), the
-- order falls back to exactly today's existing behavior — shipping_fee
-- stays 0, shipping_payment_method stays 'receiver_pays_on_delivery',
-- and propose_order_shipping_fee/respond_order_shipping_fee (untouched
-- by this migration) remain the manual override path. Checkout never
-- hard-fails just because automatic pricing wasn't possible for a
-- particular cart.
--
-- Neither quote_order() nor place_order() accept a shipping fee number
-- from the client anymore -- only delivery coordinates, which aren't a
-- financial value. This removes shipping fee from the set of
-- client-controllable checkout inputs entirely.
-- =====================================================================

alter table public.orders add column if not exists shipping_pricing_rule_id uuid references public.shipping_pricing_rules(id);
alter table public.orders add column if not exists shipping_fee_breakdown jsonb;

-- ---------------------------------------------------------------------
-- quote_order — checkout preview. Delivery coordinates are read-only
-- inputs here (nothing is written), so trusting the client-supplied pin
-- for this preview call is fine; place_order() below independently
-- recomputes everything it actually charges for.
-- ---------------------------------------------------------------------
drop function if exists public.quote_order(uuid, jsonb, numeric, text);

create or replace function public.quote_order(
  p_merchant_id uuid, p_items jsonb,
  p_delivery_latitude numeric default null, p_delivery_longitude numeric default null,
  p_voucher_code text default null
)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  buyer uuid := auth.uid(); buyer_role public.user_role; item jsonb; p public.products; qty integer;
  unit_price numeric(12,2); campaign_price numeric(12,2); subtotal numeric(12,2) := 0;
  reseller_fee numeric(12,2) := 0; merchant_fee numeric(12,2); settings public.revenue_settings;
  v_voucher record; v_voucher_valid boolean := false; v_voucher_discount numeric(12,2) := 0; v_voucher_error text;
  v_pickup_lat numeric; v_pickup_lng numeric; v_distance_raw numeric; v_shipping_calc jsonb;
  v_shipping_fee numeric(12,2) := 0; v_distance_km numeric(10,2); v_vehicle text; v_shipping_status text := 'location_required';
begin
  if buyer is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'EMPTY_CART'; end if;
  select role into buyer_role from public.profiles where id = buyer;
  select * into settings from public.revenue_settings where id = true;
  for item in select * from jsonb_array_elements(p_items) loop
    select * into p from public.products where id = (item->>'product_id')::uuid and merchant_id = p_merchant_id;
    if p is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
    qty := (item->>'quantity')::integer;
    if qty is null or qty < 1 then raise exception 'INVALID_QUANTITY'; end if;
    unit_price := case when buyer_role = 'reseller' and p.wholesale_price > 0 then p.wholesale_price else p.price end;
    select least(unit_price, coalesce(min((tier->>'price')::numeric), unit_price)) into unit_price
      from jsonb_array_elements(coalesce(p.discount_tiers, '[]'::jsonb)) tier
      where qty >= coalesce((tier->>'min_qty')::integer, 2147483647);
    select r.campaign_price into campaign_price from public.resolve_campaign_price(p.id, p.price, p_merchant_id) r;
    if campaign_price is not null and campaign_price < unit_price then unit_price := campaign_price; end if;
    subtotal := subtotal + (unit_price * qty);
  end loop;
  if buyer_role = 'reseller' then reseller_fee := greatest(settings.reseller_fee_minimum, least(settings.reseller_fee_maximum, round(subtotal * settings.reseller_service_fee_percent / 100, 2))); end if;
  merchant_fee := round(subtotal * settings.merchant_success_fee_percent / 100, 2);

  select pickup_latitude, pickup_longitude into v_pickup_lat, v_pickup_lng from public.merchant_profiles where id = p_merchant_id;
  if v_pickup_lat is not null and v_pickup_lng is not null and p_delivery_latitude is not null and p_delivery_longitude is not null then
    v_distance_raw := public.haversine_km(v_pickup_lat, v_pickup_lng, p_delivery_latitude, p_delivery_longitude);
    begin
      v_shipping_calc := public.calculate_standard_shipping(p_merchant_id, p_items, v_distance_raw);
      v_shipping_fee := (v_shipping_calc->>'fee')::numeric;
      v_distance_km := (v_shipping_calc->>'billing_distance_km')::numeric;
      v_vehicle := v_shipping_calc->>'vehicle';
      v_shipping_status := 'calculated';
    exception when others then
      v_shipping_fee := 0;
      v_shipping_status := 'pending_manual_quotation';
    end;
  end if;

  if p_voucher_code is not null and length(trim(p_voucher_code)) > 0 then
    select * into v_voucher from public.resolve_voucher(p_voucher_code, buyer, p_merchant_id, p_items, subtotal, v_shipping_fee);
    v_voucher_valid := v_voucher.valid;
    if v_voucher_valid then
      v_voucher_discount := v_voucher.discount_amount;
      if v_voucher.applies_to = 'shipping' then v_shipping_fee := greatest(0, v_shipping_fee - v_voucher_discount); else subtotal := subtotal - v_voucher_discount; end if;
    else
      v_voucher_error := v_voucher.error;
    end if;
  end if;

  return jsonb_build_object(
    'subtotal', subtotal, 'shipping_fee', v_shipping_fee, 'shipping_status', v_shipping_status,
    'distance_km', v_distance_km, 'shipping_vehicle', v_vehicle,
    'reseller_fee', reseller_fee, 'merchant_fee', merchant_fee,
    'total', subtotal + v_shipping_fee + reseller_fee,
    'reseller_fee_percent', settings.reseller_service_fee_percent, 'merchant_fee_percent', settings.merchant_success_fee_percent,
    'reseller_fee_minimum', settings.reseller_fee_minimum, 'reseller_fee_maximum', settings.reseller_fee_maximum,
    'voucher_discount', v_voucher_discount, 'voucher_valid', v_voucher_valid, 'voucher_error', v_voucher_error
  );
end $$;

grant execute on function public.quote_order(uuid, jsonb, numeric, numeric, text) to authenticated;

-- ---------------------------------------------------------------------
-- place_order — the money/stock primitive. p_shipping_fee is gone;
-- shipping is now computed here, the same way quote_order() previews
-- it, from delivery coordinates that carry no financial meaning on
-- their own.
-- ---------------------------------------------------------------------
drop function if exists public.place_order(uuid, text, jsonb, numeric, text);

create or replace function public.place_order(
  p_merchant_id uuid, p_shipping_address text, p_items jsonb,
  p_delivery_latitude numeric default null, p_delivery_longitude numeric default null,
  p_voucher_code text default null
)
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  buyer uuid := auth.uid(); item jsonb; product record; qty integer;
  unit_price numeric(12,2); campaign_price numeric(12,2); item_campaign_id uuid;
  subtotal numeric(12,2) := 0; product_total numeric(12,2); total numeric(12,2);
  reseller_fee numeric(12,2) := 0; merchant_fee numeric(12,2) := 0; buyer_role user_role;
  wallet record; placed public.orders; settings public.revenue_settings; tax_reserve numeric(12,2);
  v_voucher record; v_voucher_id uuid; v_voucher_discount numeric(12,2) := 0;
  v_voucher_merchant_id uuid; v_voucher_code text;
  v_pickup_lat numeric; v_pickup_lng numeric; v_distance_raw numeric; v_shipping_calc jsonb;
  v_shipping_fee numeric(12,2) := 0; v_distance_km numeric(10,2); v_vehicle text; v_pricing_rule_id uuid;
  v_shipping_payment_method text := 'receiver_pays_on_delivery'; v_shipping_payment_status text := 'pay_on_delivery';
  v_shipping_rate_source text := 'Receiver pays actual shipping upon delivery'; v_shipping_breakdown jsonb;
begin
  if buyer is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'EMPTY_CART'; end if;
  select * into settings from public.revenue_settings where id = true;
  select role into buyer_role from public.profiles where id = buyer;
  select * into wallet from public.wallets where owner_id = buyer for update;
  if wallet is null then raise exception 'NO_WALLET'; end if;

  for item in select * from jsonb_array_elements(p_items) loop
    qty := (item->>'quantity')::integer;
    select * into product from public.products where id = (item->>'product_id')::uuid for update;
    if product.id is null or product.merchant_id <> p_merchant_id or not product.is_active then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    if qty < product.min_order_qty then raise exception 'BELOW_MIN_ORDER_QTY'; end if;
    if product.stock_quantity < qty then raise exception 'INSUFFICIENT_STOCK'; end if;
    unit_price := case when buyer_role = 'reseller' then coalesce(product.wholesale_price, product.price) else product.price end;
    select least(unit_price, coalesce(min((tier->>'price')::numeric), unit_price)) into unit_price
      from jsonb_array_elements(coalesce(product.discount_tiers, '[]'::jsonb)) tier where qty >= coalesce((tier->>'min_qty')::integer, 2147483647);
    select r.campaign_price into campaign_price from public.resolve_campaign_price(product.id, product.price, p_merchant_id) r;
    if campaign_price is not null and campaign_price < unit_price then unit_price := campaign_price; end if;
    subtotal := subtotal + (unit_price * qty);
  end loop;

  -- Automatic shipping fee. Coordinates carry no financial meaning by
  -- themselves -- calculate_standard_shipping() (fed a distance derived
  -- from them) is what determines what gets charged, and it reads its
  -- rates from shipping_pricing_rules, not from anything the client sent.
  select pickup_latitude, pickup_longitude into v_pickup_lat, v_pickup_lng from public.merchant_profiles where id = p_merchant_id;
  if v_pickup_lat is not null and v_pickup_lng is not null and p_delivery_latitude is not null and p_delivery_longitude is not null
     and p_delivery_latitude between 4 and 21 and p_delivery_longitude between 116 and 127 then
    v_distance_raw := public.haversine_km(v_pickup_lat, v_pickup_lng, p_delivery_latitude, p_delivery_longitude);
    begin
      v_shipping_calc := public.calculate_standard_shipping(p_merchant_id, p_items, v_distance_raw);
      v_shipping_fee := (v_shipping_calc->>'fee')::numeric;
      v_distance_km := (v_shipping_calc->>'billing_distance_km')::numeric;
      v_vehicle := v_shipping_calc->>'vehicle';
      v_pricing_rule_id := (v_shipping_calc->>'rule_id')::uuid;
      v_shipping_breakdown := v_shipping_calc;
      v_shipping_payment_method := 'prepaid_wallet';
      v_shipping_payment_status := 'paid';
      v_shipping_rate_source := 'Automatic standard shipping fee';
    exception when others then
      v_shipping_fee := 0;
      v_shipping_rate_source := 'Manual quotation required (' || sqlerrm || ')';
    end;
  end if;

  if p_voucher_code is not null and length(trim(p_voucher_code)) > 0 then
    select * into v_voucher from public.resolve_voucher(p_voucher_code, buyer, p_merchant_id, p_items, subtotal, v_shipping_fee);
    if not v_voucher.valid then raise exception '%', coalesce(v_voucher.error, 'VOUCHER_INVALID'); end if;
    v_voucher_id := v_voucher.voucher_id;
    v_voucher_discount := v_voucher.discount_amount;
    if v_voucher.applies_to = 'shipping' then v_shipping_fee := greatest(0, v_shipping_fee - v_voucher_discount); else subtotal := subtotal - v_voucher_discount; end if;
  end if;

  product_total := subtotal;
  if buyer_role = 'reseller' then reseller_fee := round(product_total * settings.reseller_service_fee_percent / 100, 2); end if;
  merchant_fee := round(product_total * settings.merchant_success_fee_percent / 100, 2);
  total := product_total + v_shipping_fee + reseller_fee;
  if wallet.balance < total then raise exception 'INSUFFICIENT_BALANCE'; end if;

  insert into public.orders(
    reseller_id, merchant_id, status, subtotal, shipping_fee, total, reseller_operation_fee, platform_fee,
    merchant_gross_amount, merchant_net_amount, fee_rate_snapshot, shipping_address, voucher_discount, voucher_id,
    delivery_latitude, delivery_longitude, shipping_distance_km, shipping_vehicle, shipping_pricing_rule_id,
    shipping_fee_breakdown, shipping_payment_method, shipping_payment_status, shipping_rate_source
  )
  values(
    buyer, p_merchant_id, 'confirmed', subtotal, v_shipping_fee, total, reseller_fee, merchant_fee,
    product_total, product_total - merchant_fee,
    jsonb_build_object('merchant_success_fee_percent', settings.merchant_success_fee_percent, 'reseller_service_fee_percent', settings.reseller_service_fee_percent, 'tax_reserve_percent', settings.tax_reserve_percent),
    p_shipping_address, v_voucher_discount, v_voucher_id,
    p_delivery_latitude, p_delivery_longitude, v_distance_km, v_vehicle, v_pricing_rule_id,
    v_shipping_breakdown, v_shipping_payment_method, v_shipping_payment_status, v_shipping_rate_source
  ) returning * into placed;

  if v_voucher_id is not null then
    insert into public.voucher_redemptions(voucher_id, user_id, order_id, discount_amount) values(v_voucher_id, buyer, placed.id, v_voucher_discount);
    select merchant_id, code into v_voucher_merchant_id, v_voucher_code from public.vouchers where id = v_voucher_id;
    if v_voucher_merchant_id is not null then
      perform public.create_notification(v_voucher_merchant_id, 'voucher', format('Voucher "%s" was used', v_voucher_code),
        format('Order %s used this voucher for a %s discount.', placed.order_number, v_voucher_discount), '/merchant/vouchers',
        jsonb_build_object('voucher_id', v_voucher_id, 'order_id', placed.id));
    end if;
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    qty := (item->>'quantity')::integer;
    select * into product from public.products where id = (item->>'product_id')::uuid;
    unit_price := case when buyer_role = 'reseller' then coalesce(product.wholesale_price, product.price) else product.price end;
    select least(unit_price, coalesce(min((tier->>'price')::numeric), unit_price)) into unit_price
      from jsonb_array_elements(coalesce(product.discount_tiers, '[]'::jsonb)) tier where qty >= coalesce((tier->>'min_qty')::integer, 2147483647);
    item_campaign_id := null;
    select r.campaign_price, r.resolved_campaign_id into campaign_price, item_campaign_id from public.resolve_campaign_price(product.id, product.price, p_merchant_id) r;
    if campaign_price is not null and campaign_price < unit_price then unit_price := campaign_price; else item_campaign_id := null; end if;
    insert into public.order_items(order_id, product_id, product_name, unit_price, quantity, line_total, campaign_id) values(placed.id, product.id, product.name, unit_price, qty, unit_price * qty, item_campaign_id);
    update public.products set stock_quantity = stock_quantity - qty where id = product.id;
  end loop;

  update public.wallets set balance = balance - total, updated_at = now() where id = wallet.id;
  insert into public.wallet_transactions(wallet_id, amount, type, description, order_id) values(wallet.id, total, 'debit', 'Order ' || placed.order_number || ' payment', placed.id);
  if reseller_fee > 0 then
    tax_reserve := round(reseller_fee * settings.tax_reserve_percent / 100, 2);
    update public.platform_wallet set balance = balance + reseller_fee, updated_at = now() where id = true;
    insert into public.platform_wallet_transactions(amount, type, description, order_id, revenue_category, tax_reserve_amount) values(reseller_fee, 'credit', 'Reseller system fee - order ' || placed.order_number, placed.id, 'reseller_service_fee', tax_reserve);
  end if;
  return placed;
end $$;

revoke all on function public.place_order(uuid, text, jsonb, numeric, numeric, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- place_receiver_shipping_order — self-checkout wrapper. No longer
-- forces shipping_fee back to 0 after calling place_order(); whatever
-- place_order() computed (automatic or fallback) stands.
-- ---------------------------------------------------------------------
drop function if exists public.place_receiver_shipping_order(uuid, text, jsonb, text);

create or replace function public.place_receiver_shipping_order(
  p_merchant_id uuid, p_shipping_address text, p_items jsonb, p_voucher_code text default null,
  p_delivery_latitude numeric default null, p_delivery_longitude numeric default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_merchant_address text;
  v_buyer_address text;
  v_buyer_role public.user_role;
  v_account_status public.account_status;
  v_item jsonb;
  v_product_ids uuid[] := '{}';
  v_product_id uuid;
  v_quantity integer;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select role, account_status, address
    into v_buyer_role, v_account_status, v_buyer_address
  from public.profiles where id = auth.uid();

  if v_buyer_role not in ('merchant', 'reseller') then raise exception 'ORDER_ROLE_NOT_ALLOWED'; end if;
  if v_account_status <> 'approved'
     and not (v_buyer_role = 'merchant' and public.merchant_has_operate_grace(auth.uid()))
  then raise exception 'ACCOUNT_NOT_APPROVED'; end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'EMPTY_CART'; end if;
  if jsonb_array_length(p_items) > 100 then raise exception 'TOO_MANY_ORDER_ITEMS'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object'
       or coalesce(v_item->>'product_id', '') !~ '^[0-9a-fA-F-]{36}$'
       or coalesce(v_item->>'quantity', '') !~ '^[1-9][0-9]*$'
    then raise exception 'INVALID_ORDER_ITEM'; end if;
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    if v_product_id = any(v_product_ids) then raise exception 'DUPLICATE_CART_ITEM'; end if;
    v_product_ids := array_append(v_product_ids, v_product_id);
    if v_quantity > 100000 then raise exception 'INVALID_QUANTITY'; end if;
  end loop;

  select business_address into v_merchant_address
  from public.merchant_profiles where id = p_merchant_id and status = 'approved';
  if v_merchant_address is null then raise exception 'MERCHANT_UNAVAILABLE'; end if;

  if v_buyer_role = 'merchant' then
    select business_address into v_buyer_address from public.merchant_profiles where id = auth.uid();
  end if;
  if char_length(trim(coalesce(v_buyer_address, ''))) < 20 or v_buyer_address not like '%,%,%'
  then raise exception 'ACCOUNT_ADDRESS_INCOMPLETE'; end if;
  if char_length(trim(coalesce(v_merchant_address, ''))) < 20
     or char_length(trim(coalesce(p_shipping_address, ''))) < 20
     or v_merchant_address not like '%,%,%'
     or p_shipping_address not like '%,%,%'
  then raise exception 'INCOMPLETE_ADDRESS'; end if;

  v_order := public.place_order(p_merchant_id, p_shipping_address, p_items, p_delivery_latitude, p_delivery_longitude, p_voucher_code);
  return v_order;
end;
$$;

revoke all on function public.place_receiver_shipping_order(uuid, text, jsonb, text, numeric, numeric) from public, anon;
grant execute on function public.place_receiver_shipping_order(uuid, text, jsonb, text, numeric, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- place_customer_receiver_shipping_order — order-for-a-customer wrapper.
-- Delivery coordinates come from the customer's own saved pin, fetched
-- server-side, not from the client -- consistent with how this wrapper
-- already re-fetches and compares the customer's saved address instead
-- of trusting whatever the client sends for p_shipping_address.
-- ---------------------------------------------------------------------
drop function if exists public.place_customer_receiver_shipping_order(uuid, uuid, text, jsonb, text);

create or replace function public.place_customer_receiver_shipping_order(p_merchant_id uuid, p_customer_id uuid, p_shipping_address text, p_items jsonb, p_voucher_code text default null)
returns public.orders language plpgsql security definer set search_path = public as $$
declare v_order public.orders; v_customer public.customers;
begin
  select * into v_customer from public.customers where id = p_customer_id and reseller_id = auth.uid(); if v_customer is null then raise exception 'INVALID_CUSTOMER'; end if;
  if lower(trim(v_customer.address)) <> lower(trim(p_shipping_address)) then raise exception 'CUSTOMER_ADDRESS_MISMATCH'; end if;
  v_order := public.place_receiver_shipping_order(p_merchant_id, p_shipping_address, p_items, p_voucher_code, v_customer.latitude, v_customer.longitude);
  perform set_config('app.assigning_order_customer', 'true', true); update public.orders set customer_id = v_customer.id where id = v_order.id returning * into v_order; perform set_config('app.assigning_order_customer', 'false', true);
  return v_order;
end; $$;

revoke all on function public.place_customer_receiver_shipping_order(uuid, uuid, text, jsonb, text) from public, anon;
grant execute on function public.place_customer_receiver_shipping_order(uuid, uuid, text, jsonb, text) to authenticated;

notify pgrst, 'reload schema';
