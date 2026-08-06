-- Phase 9 of TASK6.md: closes the live pricing bug found in Phase 1 --
-- place_order() (the actual money-moving RPC) never applied any campaign
-- discount, so a shopper seeing "20% OFF" in their cart was charged full
-- price at checkout. This makes place_order() the single source of truth
-- for campaign pricing, same as it already is for wholesale/quantity-tier
-- pricing -- the client still shows an estimate (existing
-- utils/campaigns.js + utils/pricing.js), but the server always
-- recomputes and never trusts it.
--
-- Also gives order_items a nullable campaign_id, so a future "campaign
-- performance view" (deferred in Phase 2's write-up) can attribute an
-- order to the exact campaign that produced its price, instead of
-- guessing from date ranges after the fact.

alter table public.order_items add column if not exists campaign_id uuid references public.campaigns(id);

-- Picks the cheaper of: an active per-product campaign submission, or an
-- active whole-store campaign join -- never both stacked, never higher
-- than the price already being paid.
create or replace function public.resolve_campaign_price(p_product_id uuid, p_base_price numeric, p_merchant_id uuid)
returns table(campaign_price numeric, resolved_campaign_id uuid)
language sql stable security definer set search_path = public as $$
  select price, cid from (
    select cp.campaign_price as price, cp.campaign_id as cid
    from public.campaign_products cp
    join public.campaigns c on c.id = cp.campaign_id
    where cp.product_id = p_product_id and cp.status = 'active' and c.is_active and now() between c.starts_at and c.ends_at
    union all
    select round(p_base_price * (1 - c.discount_percent / 100), 2) as price, c.id as cid
    from public.merchant_campaigns mc
    join public.campaigns c on c.id = mc.campaign_id
    where mc.merchant_id = p_merchant_id and c.is_active and now() between c.starts_at and c.ends_at
  ) candidates
  order by price asc
  limit 1
$$;
revoke all on function public.resolve_campaign_price(uuid, numeric, uuid) from public, anon;
grant execute on function public.resolve_campaign_price(uuid, numeric, uuid) to authenticated;

create or replace function public.place_order(p_merchant_id uuid, p_shipping_address text, p_items jsonb, p_shipping_fee numeric default 0)
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  buyer uuid := auth.uid(); item jsonb; product record; qty integer;
  unit_price numeric(12,2); campaign_price numeric(12,2); item_campaign_id uuid;
  subtotal numeric(12,2) := 0; product_total numeric(12,2); total numeric(12,2);
  reseller_fee numeric(12,2) := 0; merchant_fee numeric(12,2) := 0; buyer_role user_role;
  wallet record; placed public.orders; settings public.revenue_settings; tax_reserve numeric(12,2);
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

  product_total := subtotal;
  if buyer_role = 'reseller' then reseller_fee := round(product_total * settings.reseller_service_fee_percent / 100, 2); end if;
  merchant_fee := round(product_total * settings.merchant_success_fee_percent / 100, 2);
  total := product_total + coalesce(p_shipping_fee, 0) + reseller_fee;
  if wallet.balance < total then raise exception 'INSUFFICIENT_BALANCE'; end if;

  insert into public.orders(reseller_id, merchant_id, status, subtotal, shipping_fee, total, reseller_operation_fee, platform_fee, merchant_gross_amount, merchant_net_amount, fee_rate_snapshot, shipping_address)
  values(buyer, p_merchant_id, 'confirmed', subtotal, coalesce(p_shipping_fee, 0), total, reseller_fee, merchant_fee, product_total, product_total - merchant_fee, jsonb_build_object('merchant_success_fee_percent', settings.merchant_success_fee_percent, 'reseller_service_fee_percent', settings.reseller_service_fee_percent, 'tax_reserve_percent', settings.tax_reserve_percent), p_shipping_address) returning * into placed;

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

-- quote_order() is the pre-checkout preview (Reseller/Checkout.jsx calls
-- it before showing "Please wait for the secure price verification").
-- It must apply the exact same campaign pricing as place_order() above,
-- or the previewed total would stop matching what's actually charged --
-- just the opposite direction of the original bug.
create or replace function public.quote_order(p_merchant_id uuid, p_items jsonb, p_shipping_fee numeric default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  buyer uuid := auth.uid(); buyer_role public.user_role; item jsonb; p public.products; qty integer;
  unit_price numeric(12,2); campaign_price numeric(12,2); subtotal numeric(12,2) := 0;
  reseller_fee numeric(12,2) := 0; merchant_fee numeric(12,2); settings public.revenue_settings;
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
  return jsonb_build_object('subtotal', subtotal, 'shipping_fee', coalesce(p_shipping_fee, 0), 'reseller_fee', reseller_fee, 'merchant_fee', merchant_fee, 'total', subtotal + coalesce(p_shipping_fee, 0) + reseller_fee, 'reseller_fee_percent', settings.reseller_service_fee_percent, 'merchant_fee_percent', settings.merchant_success_fee_percent, 'reseller_fee_minimum', settings.reseller_fee_minimum, 'reseller_fee_maximum', settings.reseller_fee_maximum);
end $$;

notify pgrst, 'reload schema';
