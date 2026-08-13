-- =====================================================================
-- Phase 2 of the address/PSGC/shipping refactor: haversine distance +
-- an admin-configurable pricing-rules table, replacing the hardcoded
-- constants inside calculate_standard_shipping().
--
-- Per the client's decision, there is no routing API (OSRM/Google/
-- Mapbox) anywhere in this system — distance is a straight-line
-- (haversine) calculation between two map pins, scaled by a
-- configurable "road directness" multiplier to approximate actual road
-- travel. This keeps the whole address/shipping stack free of external
-- services, hosting, and API keys.
-- =====================================================================

-- ---------------------------------------------------------------------
-- haversine_km — great-circle distance between two lat/lng points, in
-- kilometers. Pure arithmetic, no table access, marked immutable so
-- Postgres can cache repeated calls with the same inputs within a query.
-- ---------------------------------------------------------------------
create or replace function public.haversine_km(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric)
returns numeric
language sql
immutable
parallel safe
as $$
  select (
    6371 * 2 * asin(
      sqrt(
        power(sin(radians(lat2 - lat1) / 2), 2)
        + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
      )
    )
  )::numeric
$$;

grant execute on function public.haversine_km(numeric, numeric, numeric, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- shipping_pricing_rules — versioned/effective-dated config, mirroring
-- the existing system_policies precedent (system_policies_migration.sql):
-- draft -> published -> archived, one published row per vehicle_type at
-- a time (enforced by the partial unique index below, not client-side),
-- transitioned through a dedicated publish RPC rather than a plain
-- UPDATE. This is what lets an admin change shipping rates without a
-- code deploy, and lets a historical order keep showing the rate that
-- actually applied at checkout (via orders.shipping_pricing_rule_id,
-- added in a later migration).
-- ---------------------------------------------------------------------
create table if not exists public.shipping_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  version integer not null,
  vehicle_type text not null check (vehicle_type in ('motorcycle', 'sedan')),
  base_fee numeric(12,2) not null check (base_fee >= 0),
  included_distance_km numeric(6,2) not null check (included_distance_km >= 0),
  rate_per_km numeric(12,2) not null check (rate_per_km >= 0),
  additional_distance_rate numeric(12,2) not null check (additional_distance_rate >= 0),
  minimum_fee numeric(12,2) check (minimum_fee is null or minimum_fee >= 0),
  maximum_fee numeric(12,2) check (maximum_fee is null or maximum_fee >= 0),
  surcharge_percent numeric(5,2) not null default 0 check (surcharge_percent between 0 and 100),
  rounding_increment numeric(6,2) not null default 5 check (rounding_increment > 0),
  road_directness_multiplier numeric(4,2) not null default 1.3 check (road_directness_multiplier >= 1),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  effective_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  unique (vehicle_type, version)
);
create unique index if not exists shipping_pricing_rules_one_published_idx
  on public.shipping_pricing_rules(vehicle_type) where status = 'published';
create index if not exists shipping_pricing_rules_latest_idx
  on public.shipping_pricing_rules(vehicle_type, status, effective_date desc, created_at desc);

alter table public.shipping_pricing_rules enable row level security;
drop policy if exists "shipping_pricing_rules_read" on public.shipping_pricing_rules;
create policy "shipping_pricing_rules_read" on public.shipping_pricing_rules for select using (status = 'published' or public.is_admin());
drop policy if exists "shipping_pricing_rules_admin_manage" on public.shipping_pricing_rules;
create policy "shipping_pricing_rules_admin_manage" on public.shipping_pricing_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.shipping_pricing_rules to anon, authenticated;
grant insert, update, delete on public.shipping_pricing_rules to authenticated;

create or replace function public.publish_shipping_pricing_rule(target_id uuid)
returns public.shipping_pricing_rules language plpgsql security definer set search_path = public as $$
declare selected public.shipping_pricing_rules;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  select * into selected from public.shipping_pricing_rules where id = target_id for update;
  if selected.id is null then raise exception 'Pricing rule version not found'; end if;
  update public.shipping_pricing_rules set status = 'archived', updated_at = now()
    where vehicle_type = selected.vehicle_type and status = 'published' and id <> target_id;
  update public.shipping_pricing_rules set status = 'published', updated_at = now()
    where id = target_id returning * into selected;
  return selected;
end $$;
revoke all on function public.publish_shipping_pricing_rule(uuid) from public;
grant execute on function public.publish_shipping_pricing_rule(uuid) to authenticated;

-- Seed v1 with today's existing hardcoded rate constants (base fee,
-- included distance, per-km rates) so the *rate structure* is unchanged
-- by this migration — it only moves those numbers from SQL literals
-- into admin-editable data. The computed fee for a given real-world trip
-- will still shift slightly going forward, because the distance input
-- itself changes from OSRM road-distance to haversine x 1.3; that's the
-- client's confirmed tradeoff (§Decision B in the audit doc), not a
-- side effect of this migration.
insert into public.shipping_pricing_rules
  (version, vehicle_type, base_fee, included_distance_km, rate_per_km, additional_distance_rate, rounding_increment, road_directness_multiplier, status, effective_date)
values
  (1, 'motorcycle', 49, 5, 6, 5, 5, 1.3, 'published', current_date),
  (1, 'sedan', 100, 5, 18, 15, 5, 1.3, 'published', current_date)
on conflict (vehicle_type, version) do nothing;

-- ---------------------------------------------------------------------
-- calculate_standard_shipping, rewritten to read shipping_pricing_rules
-- instead of hardcoded literals. Vehicle-selection logic (weight/
-- dimension thresholds, special-handling detection) is unchanged from
-- 20260813000100_shipping_engine_tracked_migration.sql. Error codes and
-- the returned jsonb shape are unchanged, since ShippingFeeModal.jsx
-- matches on both.
--
-- p_distance_km is the straight-line (haversine) distance between
-- pickup and delivery pins — the caller does not apply any multiplier;
-- this function applies the selected rule's own road_directness_multiplier
-- internally, since which rule (and therefore which multiplier) applies
-- depends on the vehicle, and vehicle is only known once the cart's
-- weight/dimensions have been evaluated below.
-- ---------------------------------------------------------------------
create or replace function public.calculate_standard_shipping(p_merchant_id uuid, p_items jsonb, p_distance_km numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb; v_product record; v_qty integer;
  v_weight numeric := 0; v_volume numeric := 0; v_length numeric := 0; v_width numeric := 0; v_height numeric := 0;
  v_special boolean := false; v_distance integer; v_vehicle text;
  v_rule public.shipping_pricing_rules; v_charge numeric; v_fee numeric;
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

  if not v_special and v_weight <= 20 and v_length <= 50 and v_width <= 40 and v_height <= 50 and v_volume <= 100000
    then v_vehicle := 'Motorcycle';
    else v_vehicle := 'Sedan';
  end if;

  select * into v_rule from public.shipping_pricing_rules
    where vehicle_type = lower(v_vehicle) and status = 'published'
    order by effective_date desc, created_at desc limit 1;
  if v_rule.id is null then raise exception 'SHIPPING_PRICING_NOT_CONFIGURED'; end if;

  v_distance := ceil(p_distance_km * v_rule.road_directness_multiplier);
  if v_distance <= v_rule.included_distance_km
    then v_charge := v_distance * v_rule.rate_per_km;
    else v_charge := v_rule.included_distance_km * v_rule.rate_per_km + (v_distance - v_rule.included_distance_km) * v_rule.additional_distance_rate;
  end if;

  v_fee := (v_rule.base_fee + v_charge) * (1 + v_rule.surcharge_percent / 100);
  v_fee := ceil(v_fee / v_rule.rounding_increment) * v_rule.rounding_increment;
  if v_rule.minimum_fee is not null then v_fee := greatest(v_fee, v_rule.minimum_fee); end if;
  if v_rule.maximum_fee is not null then v_fee := least(v_fee, v_rule.maximum_fee); end if;

  return jsonb_build_object('vehicle', v_vehicle, 'fee', v_fee, 'billing_distance_km', v_distance, 'weight_kg', v_weight, 'volume_cm3', v_volume, 'rule_id', v_rule.id);
end; $$;

grant execute on function public.calculate_standard_shipping(uuid, jsonb, numeric) to authenticated;

notify pgrst, 'reload schema';
