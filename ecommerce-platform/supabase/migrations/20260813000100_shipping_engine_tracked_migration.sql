-- =====================================================================
-- Phase 0 of the address/PSGC/shipping refactor: move the still-live
-- parts of supabase/shipping_engine_migration.sql (untracked, applied
-- manually, outside the numbered migration sequence) into a tracked
-- migration, and drop the parts confirmed dead.
--
-- Why this matters: 20260723000900_quote_order_self_contained_pricing.sql
-- documents that this same untracked-file pattern already broke
-- quote_order() once in production (PostgREST's schema cache had no
-- matching function). calculate_standard_shipping and its supporting
-- objects have the identical exposure today.
--
-- What moves over verbatim (still in active use):
--   * profiles.address, and the products/orders columns
--     calculate_standard_shipping and the order-creation triggers read
--   * shipping_settings table
--   * calculate_standard_shipping() — formula unchanged here; making its
--     constants admin-configurable is a separate, later migration
--   * require_complete_customer_address() trigger (customers.address)
--   * save_signup_address() trigger (auth.users -> profiles/merchant_profiles)
--
-- What gets dropped (confirmed dead — grep of ecommerce-platform/src
-- found no caller for any of these; only calculate_standard_shipping
-- itself is invoked directly, from ShippingFeeModal.jsx):
--   * place_standard_order, place_customer_standard_order
--   * place_mapped_order, place_customer_mapped_order
--   * shipping_distance_quotes table (fed a distance-quote flow that
--     was never wired into the frontend)
--
-- Intentionally NOT duplicated here because they're already defined in
-- later tracked migrations (last write wins, so re-adding stale copies
-- here would be dead weight, not a fix):
--   * merchant_profiles.pickup_latitude/pickup_longitude,
--     customers.latitude/longitude (20260729001100_lalamove_booking_pipeline.sql)
--   * place_order, place_receiver_shipping_order,
--     place_customer_receiver_shipping_order (hardened later, most
--     recently in 20260810000900_checkout_rpc_hardening.sql)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Columns calculate_standard_shipping / the two triggers below depend on.
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists address text;

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

-- ---------------------------------------------------------------------
-- shipping_settings — singleton config row. buffer_percent is currently
-- unused by calculate_standard_shipping (a stub, per the audit); left
-- as-is rather than removed, since dropping a column is riskier than
-- leaving an unread one. Superseded by shipping_pricing_rules once that
-- migration lands.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- calculate_standard_shipping — moved verbatim from the untracked file.
-- Called directly by ShippingFeeModal.jsx's "Free distance estimate"
-- path today. Formula unchanged; becomes config-driven in a later
-- migration once shipping_pricing_rules exists.
-- ---------------------------------------------------------------------
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

grant execute on function public.calculate_standard_shipping(uuid, jsonb, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- Dead RPCs — confirmed unused by ecommerce-platform/src (only
-- calculate_standard_shipping is called directly; order creation goes
-- through place_order/place_receiver_shipping_order instead).
-- ---------------------------------------------------------------------
drop function if exists public.place_customer_standard_order(uuid, uuid, text, jsonb, numeric);
drop function if exists public.place_standard_order(uuid, text, jsonb, numeric);
drop function if exists public.place_customer_mapped_order(uuid, uuid, text, jsonb, uuid);
drop function if exists public.place_mapped_order(uuid, text, jsonb, uuid);
drop table if exists public.shipping_distance_quotes;

-- ---------------------------------------------------------------------
-- require_complete_customer_address — active validation trigger on
-- customers.address, moved verbatim.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- save_signup_address — captures the address entered at signup onto
-- profiles/merchant_profiles without exposing privileged fields to the
-- client, moved verbatim.
-- ---------------------------------------------------------------------
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

notify pgrst, 'reload schema';
