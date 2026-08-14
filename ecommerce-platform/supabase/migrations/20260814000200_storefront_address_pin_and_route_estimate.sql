-- Three additive changes so the storefront-order flow matches how the
-- rest of the app already handles addresses: PSGC + Leaflet pin, not
-- free text, with an automatic fee shown as early as possible.
--
-- 1) PSGC reference tables become anon-readable. The customer storefront
--    (src/pages/ResellerStorefront.jsx) is a deliberately no-login page —
--    "Customer selects How to Buy... no account needed" per
--    docs/SYSTEM_OVERVIEW.md — but AddressFields.jsx's province/city/
--    barangay dropdowns could only ever be used by a logged-in user
--    until now, so the storefront's own order-request form has always
--    used a bare free-text textarea instead of the same PSGC+map picker
--    every other address form in the app uses. PSGC data (city/barangay
--    names) has no sensitivity — there's nothing here worth gating.
drop policy if exists "psgc_provinces_read" on public.psgc_provinces;
create policy "psgc_provinces_read" on public.psgc_provinces for select using (true);
drop policy if exists "psgc_cities_read" on public.psgc_cities;
create policy "psgc_cities_read" on public.psgc_cities for select using (true);
drop policy if exists "psgc_barangays_read" on public.psgc_barangays;
create policy "psgc_barangays_read" on public.psgc_barangays for select using (true);
grant select on public.psgc_provinces, public.psgc_cities, public.psgc_barangays to anon;

-- 2) storefront_order_requests gets the same latitude/longitude columns
--    `customers` already has, so a request that arrives with a pinned
--    location can be converted into a customer record automatically
--    (no Reseller re-pinning needed) instead of always stopping at the
--    "complete this customer's address" prompt in
--    StorefrontOrderRequests.jsx.
alter table public.storefront_order_requests add column if not exists customer_latitude numeric;
alter table public.storefront_order_requests add column if not exists customer_longitude numeric;

-- New 9-arg overload of submit_storefront_order_request, coexisting with
-- the existing 7-arg version -- same pattern as quote_order's legacy
-- compat overload (20260813000900_quote_order_legacy_compat.sql):
-- CREATE OR REPLACE cannot add parameters to an existing signature, so
-- this creates a second overload rather than silently breaking anything
-- still calling the old one.
create or replace function public.submit_storefront_order_request(
  p_reseller_id uuid,
  p_product_id uuid,
  p_quantity int,
  p_customer_name text,
  p_customer_phone text default null,
  p_customer_address text default null,
  p_customer_notes text default null,
  p_customer_latitude numeric default null,
  p_customer_longitude numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reseller public.profiles;
  v_product public.products;
  v_name text;
  v_phone text;
  v_address text;
  v_notes text;
  v_lat numeric;
  v_lng numeric;
  v_headers jsonb;
  v_caller_ip text;
  v_fingerprint text;
  v_id uuid;
begin
  select * into v_reseller from public.profiles where id = p_reseller_id;
  if v_reseller.id is null or v_reseller.role <> 'reseller' or v_reseller.account_status <> 'approved' then
    raise exception 'RESELLER_NOT_AVAILABLE';
  end if;

  if not exists (
    select 1 from public.reseller_storefront_products
    where reseller_id = p_reseller_id and product_id = p_product_id
  ) then
    raise exception 'PRODUCT_NOT_ON_STOREFRONT';
  end if;

  select * into v_product from public.products where id = p_product_id;
  if v_product.id is null or not v_product.is_active then
    raise exception 'PRODUCT_UNAVAILABLE';
  end if;

  if p_quantity is null or p_quantity < greatest(1, v_product.min_order_qty) then
    raise exception 'QUANTITY_BELOW_MINIMUM';
  end if;
  if p_quantity > v_product.stock_quantity then
    raise exception 'QUANTITY_EXCEEDS_STOCK';
  end if;

  v_name := left(trim(coalesce(p_customer_name, '')), 200);
  if char_length(v_name) < 2 then
    raise exception 'CUSTOMER_NAME_REQUIRED';
  end if;
  v_phone := nullif(left(regexp_replace(coalesce(p_customer_phone,''), '[^0-9+ ]', '', 'g'), 30), '');
  v_address := nullif(left(trim(coalesce(p_customer_address, '')), 500), '');
  v_notes := nullif(left(trim(coalesce(p_customer_notes, '')), 500), '');
  -- Bounds-check same as quote_order/place_order -- a bogus pin (e.g. a
  -- stray client bug sending [0,0]) should never get silently stored.
  if p_customer_latitude is not null and p_customer_longitude is not null
     and p_customer_latitude between 4 and 21.5 and p_customer_longitude between 116 and 127 then
    v_lat := p_customer_latitude; v_lng := p_customer_longitude;
  end if;

  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
    v_caller_ip := coalesce(v_headers->>'cf-connecting-ip', split_part(v_headers->>'x-forwarded-for', ',', 1));
  exception when others then
    v_caller_ip := null;
  end;

  if v_caller_ip is not null then
    v_fingerprint := md5(v_caller_ip);
    if (
      select count(*) from public.storefront_order_requests
      where created_at > now() - interval '1 hour' and submission_fingerprint = v_fingerprint
    ) >= 5 then
      raise exception 'TOO_MANY_ORDER_REQUESTS';
    end if;
  end if;

  insert into public.storefront_order_requests (
    reseller_id, product_id, quantity, customer_name, customer_phone, customer_address, customer_notes,
    customer_latitude, customer_longitude, submission_fingerprint
  ) values (
    p_reseller_id, p_product_id, p_quantity, v_name, v_phone, v_address, v_notes, v_lat, v_lng, v_fingerprint
  ) returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.submit_storefront_order_request(uuid, uuid, int, text, text, text, text, numeric, numeric) to anon, authenticated;

-- 3) estimate_storefront_shipping_fee -- lets the storefront order-request
-- form show a live delivery-fee estimate as soon as the customer pins
-- their location, mirroring quote_order()'s automatic-pricing block but
-- read-only, anon-callable, and never raising: any failure (merchant has
-- no pickup pin, product missing package info, order too large, pin
-- outside PH bounds) just resolves to {status:"unavailable"} so a public
-- form never has to handle a thrown Postgres error.
create or replace function public.estimate_storefront_shipping_fee(
  p_reseller_id uuid,
  p_product_id uuid,
  p_quantity int,
  p_delivery_latitude numeric,
  p_delivery_longitude numeric
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_reseller public.profiles;
  v_product public.products;
  v_pickup_lat numeric;
  v_pickup_lng numeric;
  v_distance_raw numeric;
  v_shipping_calc jsonb;
begin
  if p_delivery_latitude is null or p_delivery_longitude is null
     or p_delivery_latitude not between 4 and 21.5 or p_delivery_longitude not between 116 and 127 then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select * into v_reseller from public.profiles where id = p_reseller_id;
  if v_reseller.id is null or v_reseller.role <> 'reseller' or v_reseller.account_status <> 'approved' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if not exists (
    select 1 from public.reseller_storefront_products
    where reseller_id = p_reseller_id and product_id = p_product_id
  ) then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select * into v_product from public.products where id = p_product_id;
  if v_product.id is null or not v_product.is_active then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select pickup_latitude, pickup_longitude into v_pickup_lat, v_pickup_lng
    from public.merchant_profiles where id = v_product.merchant_id;
  if v_pickup_lat is null or v_pickup_lng is null then
    return jsonb_build_object('status', 'unavailable');
  end if;

  v_distance_raw := public.haversine_km(v_pickup_lat, v_pickup_lng, p_delivery_latitude, p_delivery_longitude);
  begin
    v_shipping_calc := public.calculate_standard_shipping(
      v_product.merchant_id,
      jsonb_build_array(jsonb_build_object('product_id', p_product_id, 'quantity', greatest(1, coalesce(p_quantity, 1)))),
      v_distance_raw
    );
  exception when others then
    return jsonb_build_object('status', 'unavailable');
  end;

  return jsonb_build_object(
    'status', 'calculated',
    'fee', (v_shipping_calc->>'fee')::numeric,
    'distance_km', (v_shipping_calc->>'billing_distance_km')::numeric,
    'vehicle', v_shipping_calc->>'vehicle'
  );
end;
$$;

grant execute on function public.estimate_storefront_shipping_fee(uuid, uuid, int, numeric, numeric) to anon, authenticated;

notify pgrst, 'reload schema';
