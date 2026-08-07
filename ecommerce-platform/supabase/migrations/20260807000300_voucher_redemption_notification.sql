-- Phase 12 (cont.): notify a merchant when one of their own vouchers
-- (scope 'merchant'/'product'/'category', i.e. vouchers.merchant_id is
-- set) gets redeemed. Platform-wide vouchers (merchant_id null) aren't
-- tied to one merchant, so no notification target exists for those --
-- skipped, not an oversight.

create or replace function public.place_order(p_merchant_id uuid, p_shipping_address text, p_items jsonb, p_shipping_fee numeric default 0, p_voucher_code text default null)
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  buyer uuid := auth.uid(); item jsonb; product record; qty integer;
  unit_price numeric(12,2); campaign_price numeric(12,2); item_campaign_id uuid;
  subtotal numeric(12,2) := 0; product_total numeric(12,2); total numeric(12,2);
  reseller_fee numeric(12,2) := 0; merchant_fee numeric(12,2) := 0; buyer_role user_role;
  wallet record; placed public.orders; settings public.revenue_settings; tax_reserve numeric(12,2);
  v_voucher record; v_voucher_id uuid; v_voucher_discount numeric(12,2) := 0; v_shipping_fee numeric(12,2) := coalesce(p_shipping_fee, 0);
  v_voucher_merchant_id uuid; v_voucher_code text;
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

  if p_voucher_code is not null and length(trim(p_voucher_code)) > 0 then
    select * into v_voucher from public.resolve_voucher(p_voucher_code, buyer, p_merchant_id, p_items, subtotal, v_shipping_fee);
    if not v_voucher.valid then raise exception '%', coalesce(v_voucher.error, 'VOUCHER_INVALID'); end if;
    v_voucher_id := v_voucher.voucher_id;
    v_voucher_discount := v_voucher.discount_amount;
    if v_voucher.applies_to = 'shipping' then v_shipping_fee := v_shipping_fee - v_voucher_discount; else subtotal := subtotal - v_voucher_discount; end if;
  end if;

  product_total := subtotal;
  if buyer_role = 'reseller' then reseller_fee := round(product_total * settings.reseller_service_fee_percent / 100, 2); end if;
  merchant_fee := round(product_total * settings.merchant_success_fee_percent / 100, 2);
  total := product_total + v_shipping_fee + reseller_fee;
  if wallet.balance < total then raise exception 'INSUFFICIENT_BALANCE'; end if;

  insert into public.orders(reseller_id, merchant_id, status, subtotal, shipping_fee, total, reseller_operation_fee, platform_fee, merchant_gross_amount, merchant_net_amount, fee_rate_snapshot, shipping_address, voucher_discount, voucher_id)
  values(buyer, p_merchant_id, 'confirmed', subtotal, v_shipping_fee, total, reseller_fee, merchant_fee, product_total, product_total - merchant_fee, jsonb_build_object('merchant_success_fee_percent', settings.merchant_success_fee_percent, 'reseller_service_fee_percent', settings.reseller_service_fee_percent, 'tax_reserve_percent', settings.tax_reserve_percent), p_shipping_address, v_voucher_discount, v_voucher_id) returning * into placed;

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

notify pgrst, 'reload schema';
