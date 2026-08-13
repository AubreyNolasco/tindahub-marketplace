-- SUPERSEDED — do not run this file again.
-- Its still-live parts (shipping_settings, calculate_standard_shipping,
-- require_complete_customer_address, save_signup_address, and the
-- columns they depend on) now live in the tracked migration
-- supabase/migrations/20260813000100_shipping_engine_tracked_migration.sql.
-- Its dead parts (place_standard_order, place_customer_standard_order,
-- place_mapped_order, place_customer_mapped_order, shipping_distance_quotes)
-- were confirmed unused by ecommerce-platform/src and dropped there.
-- Kept here only for historical reference. See the audit doc for why:
-- this untracked-file pattern already broke quote_order() once in
-- production (schema-cache drift), per 20260723000900_quote_order_self_contained_pricing.sql.

-- Shipping/package data required by the Lalamove quotation workflow.
alter table public.profiles add column if not exists address text;
alter table public.merchant_profiles add column if not exists pickup_latitude numeric(10,7);
alter table public.merchant_profiles add column if not exists pickup_longitude numeric(10,7);
alter table public.products add column if not exists packed_weight_kg numeric(10,3);
alter table public.products add column if not exists packed_length_cm numeric(10,2);
alter table public.products add column if not exists packed_width_cm numeric(10,2);
alter table public.products add column if not exists packed_height_cm numeric(10,2);
alter table public.products add column if not exists product_type text;
alter table public.products add column if not exists fragile boolean not null default false;
alter table public.products add column if not exists keep_upright boolean not null default false;
alter table public.products add column if not exists motorcycle_safe boolean not null default false;
alter table public.orders add column if not exists delivery_latitude numeric(10,7);
alter table public.orders add column if not exists delivery_longitude numeric(10,7);
alter table public.orders add column if not exists delivery_datetime timestamptz;
alter table public.orders add column if not exists shipping_vehicle text;
alter table public.orders add column if not exists shipping_rate_source text;
alter table public.orders add column if not exists shipping_quotation_id text;
alter table public.orders add column if not exists shipping_quotation_expiration timestamptz;
alter table public.orders add column if not exists shipping_distance_km numeric(10,2);
alter table public.orders add column if not exists shipping_payment_method text not null default 'receiver_pays_on_delivery';
alter table public.orders add column if not exists shipping_payment_status text not null default 'pay_on_delivery';

create table if not exists public.shipping_settings (
  id boolean primary key default true check (id),
  buffer_percent numeric(5,2) not null default 0 check (buffer_percent between 0 and 100),
  updated_at timestamptz not null default now()
);
insert into public.shipping_settings(id) values(true) on conflict(id) do nothing;
alter table public.shipping_settings enable row level security;
drop policy if exists "shipping_settings_read" on public.shipping_settings;
create policy "shipping_settings_read" on public.shipping_settings for select using (true);
drop policy if exists "shipping_settings_admin" on public.shipping_settings;
create policy "shipping_settings_admin" on public.shipping_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.shipping_settings to anon, authenticated;
grant update on public.shipping_settings to authenticated;

create table if not exists public.shipping_distance_quotes (
  id uuid primary key default gen_random_uuid(), requester_id uuid not null references public.profiles(id) on delete cascade,
  merchant_id uuid not null references public.merchant_profiles(id) on delete cascade, delivery_address text not null,
  distance_km numeric(10,3) not null check (distance_km > 0), duration_seconds integer,
  created_at timestamptz not null default now(), expires_at timestamptz not null default (now() + interval '30 minutes')
);
alter table public.shipping_distance_quotes enable row level security;
drop policy if exists "shipping_distance_quotes_own_read" on public.shipping_distance_quotes;
create policy "shipping_distance_quotes_own_read" on public.shipping_distance_quotes for select to authenticated using (requester_id = auth.uid());
grant select on public.shipping_distance_quotes to authenticated;

create or replace function public.calculate_standard_shipping(p_merchant_id uuid, p_items jsonb, p_distance_km numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_item jsonb; v_product record; v_qty integer; v_weight numeric := 0; v_volume numeric := 0; v_length numeric := 0; v_width numeric := 0; v_height numeric := 0; v_special boolean := false; v_distance integer; v_vehicle text; v_base numeric; v_charge numeric; v_fee numeric;
begin
  if p_distance_km is null or p_distance_km <= 0 then raise exception 'ROAD_DISTANCE_REQUIRED'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'EMPTY_CART'; end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid and merchant_id = p_merchant_id and is_active;
    if v_product is null then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    if v_product.packed_weight_kg is null or v_product.packed_length_cm is null or v_product.packed_width_cm is null or v_product.packed_height_cm is null then raise exception 'MISSING_PACKAGE_INFORMATION'; end if;
    v_weight := v_weight + v_product.packed_weight_kg * v_qty;
    v_volume := v_volume + v_product.packed_length_cm * v_product.packed_width_cm * v_product.packed_height_cm * v_qty;
    v_length := greatest(v_length, v_product.packed_length_cm); v_width := greatest(v_width, v_product.packed_width_cm); v_height := greatest(v_height, v_product.packed_height_cm);
    v_special := v_special or v_product.fragile or v_product.keep_upright or not v_product.motorcycle_safe or coalesce(v_product.product_type, '') ~* '(cake|food tray|party tray|catering|bottled|arrangement)';
  end loop;
  if v_weight > 200 or v_length > 100 or v_width > 60 or v_height > 70 or v_volume > 420000 then raise exception 'MANUAL_QUOTATION_REQUIRED'; end if;
  v_distance := ceil(p_distance_km);
  if not v_special and v_weight <= 20 and v_length <= 50 and v_width <= 40 and v_height <= 50 and v_volume <= 100000 then v_vehicle := 'Motorcycle'; v_base := 49; v_charge := case when v_distance <= 5 then v_distance * 6 else 30 + (v_distance - 5) * 5 end;
  else v_vehicle := 'Sedan'; v_base := 100; v_charge := case when v_distance <= 5 then v_distance * 18 else 90 + (v_distance - 5) * 15 end; end if;
  v_fee := ceil((v_base + v_charge) / 5) * 5;
  return jsonb_build_object('vehicle', v_vehicle, 'fee', v_fee, 'billing_distance_km', v_distance, 'weight_kg', v_weight, 'volume_cm3', v_volume);
end; $$;

create or replace function public.place_standard_order(p_merchant_id uuid, p_shipping_address text, p_items jsonb, p_distance_km numeric)
returns public.orders language plpgsql security definer set search_path = public as $$
declare v_shipping jsonb; v_order public.orders; v_merchant_address text; v_buyer_address text; v_buyer_role user_role;
begin
  select business_address into v_merchant_address from public.merchant_profiles where id = p_merchant_id;
  select role, address into v_buyer_role, v_buyer_address from public.profiles where id = auth.uid();
  if v_buyer_role = 'merchant' then select business_address into v_buyer_address from public.merchant_profiles where id = auth.uid(); end if;
  if char_length(trim(coalesce(v_buyer_address,''))) < 20 or v_buyer_address not like '%,%,%' then raise exception 'ACCOUNT_ADDRESS_INCOMPLETE'; end if;
  if char_length(trim(coalesce(v_merchant_address,''))) < 20 or char_length(trim(coalesce(p_shipping_address,''))) < 20 or v_merchant_address not like '%,%,%' or p_shipping_address not like '%,%,%' then raise exception 'INCOMPLETE_ADDRESS'; end if;
  v_shipping := public.calculate_standard_shipping(p_merchant_id, p_items, p_distance_km);
  v_order := public.place_order(p_merchant_id, p_shipping_address, p_items, (v_shipping->>'fee')::numeric);
  update public.orders set shipping_vehicle = v_shipping->>'vehicle', shipping_rate_source = 'Standard Estimated Shipping Fee', shipping_distance_km = (v_shipping->>'billing_distance_km')::numeric where id = v_order.id returning * into v_order;
  return v_order;
end; $$;

create or replace function public.place_customer_standard_order(p_merchant_id uuid, p_customer_id uuid, p_shipping_address text, p_items jsonb, p_distance_km numeric)
returns public.orders language plpgsql security definer set search_path = public as $$
declare v_order public.orders; v_customer public.customers;
begin
  select * into v_customer from public.customers where id = p_customer_id and reseller_id = auth.uid();
  if v_customer is null then raise exception 'INVALID_CUSTOMER'; end if;
  v_order := public.place_standard_order(p_merchant_id, p_shipping_address, p_items, p_distance_km);
  perform set_config('app.assigning_order_customer', 'true', true);
  update public.orders set customer_id = v_customer.id where id = v_order.id returning * into v_order;
  perform set_config('app.assigning_order_customer', 'false', true);
  return v_order;
end; $$;

revoke execute on function public.place_order(uuid, text, jsonb, numeric) from authenticated;
grant execute on function public.calculate_standard_shipping(uuid, jsonb, numeric) to authenticated;
grant execute on function public.place_standard_order(uuid, text, jsonb, numeric) to authenticated;
grant execute on function public.place_customer_standard_order(uuid, uuid, text, jsonb, numeric) to authenticated;

create or replace function public.place_mapped_order(p_merchant_id uuid, p_shipping_address text, p_items jsonb, p_distance_quote_id uuid)
returns public.orders language plpgsql security definer set search_path = public as $$
declare v_quote public.shipping_distance_quotes; v_order public.orders;
begin
  select * into v_quote from public.shipping_distance_quotes where id = p_distance_quote_id and requester_id = auth.uid() and merchant_id = p_merchant_id and expires_at > now();
  if v_quote is null or lower(trim(v_quote.delivery_address)) <> lower(trim(p_shipping_address)) then raise exception 'SHIPPING_DISTANCE_QUOTE_INVALID'; end if;
  v_order := public.place_standard_order(p_merchant_id, p_shipping_address, p_items, v_quote.distance_km);
  return v_order;
end; $$;
create or replace function public.place_customer_mapped_order(p_merchant_id uuid, p_customer_id uuid, p_shipping_address text, p_items jsonb, p_distance_quote_id uuid)
returns public.orders language plpgsql security definer set search_path = public as $$
declare v_order public.orders; v_customer public.customers;
begin
  select * into v_customer from public.customers where id = p_customer_id and reseller_id = auth.uid(); if v_customer is null then raise exception 'INVALID_CUSTOMER'; end if;
  v_order := public.place_mapped_order(p_merchant_id, p_shipping_address, p_items, p_distance_quote_id);
  perform set_config('app.assigning_order_customer', 'true', true); update public.orders set customer_id = v_customer.id where id = v_order.id returning * into v_order; perform set_config('app.assigning_order_customer', 'false', true);
  return v_order;
end; $$;
grant execute on function public.place_mapped_order(uuid, text, jsonb, uuid) to authenticated;
grant execute on function public.place_customer_mapped_order(uuid, uuid, text, jsonb, uuid) to authenticated;

create or replace function public.place_receiver_shipping_order(p_merchant_id uuid, p_shipping_address text, p_items jsonb)
returns public.orders language plpgsql security definer set search_path = public as $$
declare v_order public.orders; v_merchant_address text; v_buyer_address text; v_buyer_role user_role;
begin
  select business_address into v_merchant_address from public.merchant_profiles where id = p_merchant_id;
  select role, address into v_buyer_role, v_buyer_address from public.profiles where id = auth.uid();
  if v_buyer_role = 'merchant' then select business_address into v_buyer_address from public.merchant_profiles where id = auth.uid(); end if;
  if char_length(trim(coalesce(v_buyer_address,''))) < 20 or v_buyer_address not like '%,%,%' then raise exception 'ACCOUNT_ADDRESS_INCOMPLETE'; end if;
  if char_length(trim(coalesce(v_merchant_address,''))) < 20 or char_length(trim(coalesce(p_shipping_address,''))) < 20 or v_merchant_address not like '%,%,%' or p_shipping_address not like '%,%,%' then raise exception 'INCOMPLETE_ADDRESS'; end if;
  v_order := public.place_order(p_merchant_id, p_shipping_address, p_items, 0);
  update public.orders set shipping_fee = 0, shipping_rate_source = 'Receiver pays actual shipping upon delivery', shipping_payment_method = 'receiver_pays_on_delivery', shipping_payment_status = 'pay_on_delivery', shipping_vehicle = null, shipping_distance_km = null where id = v_order.id returning * into v_order;
  return v_order;
end; $$;

create or replace function public.place_customer_receiver_shipping_order(p_merchant_id uuid, p_customer_id uuid, p_shipping_address text, p_items jsonb)
returns public.orders language plpgsql security definer set search_path = public as $$
declare v_order public.orders; v_customer public.customers;
begin
  select * into v_customer from public.customers where id = p_customer_id and reseller_id = auth.uid(); if v_customer is null then raise exception 'INVALID_CUSTOMER'; end if;
  if lower(trim(v_customer.address)) <> lower(trim(p_shipping_address)) then raise exception 'CUSTOMER_ADDRESS_MISMATCH'; end if;
  v_order := public.place_receiver_shipping_order(p_merchant_id, p_shipping_address, p_items);
  perform set_config('app.assigning_order_customer', 'true', true); update public.orders set customer_id = v_customer.id where id = v_order.id returning * into v_order; perform set_config('app.assigning_order_customer', 'false', true);
  return v_order;
end; $$;

revoke execute on function public.place_standard_order(uuid, text, jsonb, numeric) from authenticated;
revoke execute on function public.place_customer_standard_order(uuid, uuid, text, jsonb, numeric) from authenticated;
revoke execute on function public.place_mapped_order(uuid, text, jsonb, uuid) from authenticated;
revoke execute on function public.place_customer_mapped_order(uuid, uuid, text, jsonb, uuid) from authenticated;
grant execute on function public.place_receiver_shipping_order(uuid, text, jsonb) to authenticated;
grant execute on function public.place_customer_receiver_shipping_order(uuid, uuid, text, jsonb) to authenticated;

create or replace function public.require_complete_customer_address()
returns trigger language plpgsql set search_path = public as $$
begin
  new.address := trim(coalesce(new.address, ''));
  if char_length(new.address) < 25 or new.address !~ '[0-9]' or new.address !~ '^[^,]+,[^,]+,[^,]+,[^,]+' then
    raise exception 'CUSTOMER_ADDRESS_INCOMPLETE';
  end if;
  return new;
end; $$;
drop trigger if exists trg_require_complete_customer_address on public.customers;
create trigger trg_require_complete_customer_address before insert or update of address on public.customers for each row execute function public.require_complete_customer_address();

-- Capture required addresses for new accounts without exposing privileged fields.
create or replace function public.save_signup_address()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role text := coalesce(new.raw_user_meta_data->>'role', 'reseller'); v_address text := trim(coalesce(new.raw_user_meta_data->>'address', ''));
begin
  if char_length(v_address) > 0 then
    update public.profiles set address = v_address where id = new.id;
    if v_role = 'merchant' then update public.merchant_profiles set business_address = v_address where id = new.id; end if;
  end if;
  return new;
end; $$;
drop trigger if exists trg_save_signup_address on auth.users;
create trigger trg_save_signup_address after insert on auth.users for each row execute function public.save_signup_address();
