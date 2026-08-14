-- Two small, additive fixes from a system-flow review (see
-- suggestionflowbyClaud.md). Neither changes what anyone is charged or
-- when -- both only expose information that already exists, so a real
-- click-through order flows exactly as it does today.

-- ---------------------------------------------------------------------
-- 1) dispatch_ready -- a single, generated answer to "is this order
-- ready to dispatch", mirroring the exact boolean already enforced by
-- enforce_shipping_fee_before_dispatch() and set_order_delivery()
-- (20260813000600_prepaid_dispatch_fix.sql). Those two functions are the
-- real gate and are untouched here. Before this, three frontend call
-- sites (Merchant/Orders.jsx x2, DeliveryModal.jsx) each independently
-- re-typed `shipping_payment_method === 'prepaid_wallet'` to answer the
-- same question -- any future change to the rule had to be made in four
-- places (three frontend + the DB) and could silently drift out of sync
-- in one of them. This column can never drift, because it's computed
-- from the same two columns the DB gate itself reads.
-- ---------------------------------------------------------------------
alter table public.orders add column if not exists dispatch_ready boolean
  generated always as (
    shipping_payment_method = 'prepaid_wallet'
    or (shipping_fee_confirmation_status = 'accepted' and proposed_shipping_fee is not null)
  ) stored;

-- ---------------------------------------------------------------------
-- 2) quote_order() -- when automatic pricing can't be computed
-- (MISSING_PACKAGE_INFORMATION, MANUAL_QUOTATION_REQUIRED, etc.), the
-- exception handler has always swallowed sqlerrm and returned nothing
-- about why. place_order() already captures the identical value into
-- orders.shipping_rate_source (see 20260813000400), so the reason has
-- existed in the database since that migration -- it just never made it
-- into quote_order()'s checkout PREVIEW, so a Reseller/Merchant had no
-- way to see why pricing fell back to manual until after the order
-- existed. This is the exact gap TASK11.md flagged under "Reviewed but
-- not changed": ShippingFeeModal.jsx lost its error-code-to-message
-- mapping when the old estimate button was removed, with no in-app way
-- for a Merchant to learn why automatic pricing keeps failing for them.
--
-- Purely additive: same signature, one new key in the returned jsonb.
-- Body is otherwise byte-for-byte identical to
-- 20260813000400_automatic_shipping_checkout.sql's quote_order().
-- ---------------------------------------------------------------------
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
  v_shipping_fallback_reason text;
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
  if v_pickup_lat is not null and v_pickup_lng is not null and p_delivery_latitude is not null and p_delivery_longitude is not null
     and p_delivery_latitude between 4 and 21.5 and p_delivery_longitude between 116 and 127 then
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
      v_shipping_fallback_reason := sqlerrm;
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
    'distance_km', v_distance_km, 'shipping_vehicle', v_vehicle, 'shipping_fallback_reason', v_shipping_fallback_reason,
    'reseller_fee', reseller_fee, 'merchant_fee', merchant_fee,
    'total', subtotal + v_shipping_fee + reseller_fee,
    'reseller_fee_percent', settings.reseller_service_fee_percent, 'merchant_fee_percent', settings.merchant_success_fee_percent,
    'reseller_fee_minimum', settings.reseller_fee_minimum, 'reseller_fee_maximum', settings.reseller_fee_maximum,
    'voucher_discount', v_voucher_discount, 'voucher_valid', v_voucher_valid, 'voucher_error', v_voucher_error
  );
end $$;

grant execute on function public.quote_order(uuid, jsonb, numeric, numeric, text) to authenticated;

notify pgrst, 'reload schema';
