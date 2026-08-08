-- The Rating filter on Catalog.jsx looked broken to the owner --
-- clicking "4 stars & up" (or any threshold) never excluded a single
-- product. Root cause found by reading the actual data, not the
-- filter code: admin_seed_sample_catalog() only ever generated a
-- rating of 4 or 5 (`case when random() > 0.5 then 5 else 4 end`), so
-- every sample product already passed every available threshold --
-- the filter was working correctly, there was just nothing below 4
-- stars for it to ever demonstrate excluding. Widening the spread so
-- future seed runs produce a realistic, skewed-positive distribution
-- that can actually show the filter doing something.
create or replace function public.admin_seed_sample_catalog(p_products jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_item jsonb;
  v_existing_id uuid;
  v_product_id uuid;
  v_order_id uuid;
  v_qty int;
  v_price numeric;
  v_rating int;
  v_added int := 0;
  v_updated int := 0;
  v_reviews_added int := 0;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select lower(email) into v_email from auth.users where id = v_uid;
  if v_email is distinct from 'nolascoaubrey32@gmail.com' then raise exception 'NOT_PERMITTED'; end if;
  if not exists (select 1 from public.merchant_profiles where id = v_uid and status = 'approved') then
    raise exception 'DEMO_MERCHANT_NOT_APPROVED';
  end if;

  for v_item in select * from jsonb_array_elements(p_products) loop
    v_price := (v_item->>'price')::numeric;
    select id into v_existing_id from public.products where merchant_id = v_uid and sku = v_item->>'sku';

    if v_existing_id is null then
      insert into public.products (
        merchant_id, category_id, sku, name, description, price, wholesale_price, suggested_retail_price,
        stock_quantity, min_order_qty, discount_tiers, packed_weight_kg, packed_length_cm,
        packed_width_cm, packed_height_cm, product_type, fragile, keep_upright, motorcycle_safe,
        images, is_active
      ) values (
        v_uid, nullif(v_item->>'category_id', '')::uuid, v_item->>'sku', v_item->>'name', v_item->>'description',
        v_price, (v_item->>'wholesale_price')::numeric, (v_item->>'suggested_retail_price')::numeric,
        (v_item->>'stock_quantity')::int, (v_item->>'min_order_qty')::int, coalesce(v_item->'discount_tiers', '[]'::jsonb),
        (v_item->>'packed_weight_kg')::numeric, (v_item->>'packed_length_cm')::numeric,
        (v_item->>'packed_width_cm')::numeric, (v_item->>'packed_height_cm')::numeric,
        v_item->>'product_type', coalesce((v_item->>'fragile')::boolean, false), coalesce((v_item->>'keep_upright')::boolean, false), coalesce((v_item->>'motorcycle_safe')::boolean, false),
        coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(v_item->'images', '[]'::jsonb)) x), '{}'::text[]), true
      ) returning id into v_product_id;
      v_added := v_added + 1;
    else
      update public.products set
        category_id = nullif(v_item->>'category_id', '')::uuid,
        name = v_item->>'name', description = v_item->>'description', price = v_price,
        wholesale_price = (v_item->>'wholesale_price')::numeric, suggested_retail_price = (v_item->>'suggested_retail_price')::numeric,
        stock_quantity = (v_item->>'stock_quantity')::int, min_order_qty = (v_item->>'min_order_qty')::int,
        discount_tiers = coalesce(v_item->'discount_tiers', '[]'::jsonb),
        packed_weight_kg = (v_item->>'packed_weight_kg')::numeric, packed_length_cm = (v_item->>'packed_length_cm')::numeric,
        packed_width_cm = (v_item->>'packed_width_cm')::numeric, packed_height_cm = (v_item->>'packed_height_cm')::numeric,
        product_type = v_item->>'product_type',
        images = coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(v_item->'images', '[]'::jsonb)) x), '{}'::text[]),
        is_active = true, updated_at = now()
      where id = v_existing_id
      returning id into v_product_id;
      v_updated := v_updated + 1;
    end if;

    if not exists (select 1 from public.product_reviews where product_id = v_product_id and reseller_id = v_uid) then
      v_qty := 20 + floor(random() * 60)::int;
      insert into public.orders (reseller_id, merchant_id, status, subtotal, shipping_fee, total, shipping_address, notes, reseller_operation_fee)
      values (v_uid, v_uid, 'completed', v_price * v_qty, 0, v_price * v_qty, 'SAMPLE DATA - JOM HUB internal demo catalog, not a real delivery address', 'SAMPLE_CATALOG_SEED', 0)
      returning id into v_order_id;

      insert into public.order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
      values (v_order_id, v_product_id, v_item->>'name', v_price, v_qty, v_price * v_qty);

      -- Skewed-positive but real variance: ~8% 2-star, ~17% 3-star,
      -- ~40% 4-star, ~35% 5-star -- close to how genuine review
      -- distributions actually look, and enough spread for the
      -- Rating filter to have something below any given threshold.
      v_rating := case
        when random() < 0.08 then 2
        when random() < 0.25 then 3
        when random() < 0.65 then 4
        else 5
      end;

      perform public.switch_role_for_demo('reseller');
      insert into public.product_reviews (product_id, reseller_id, order_id, rating, comment)
      values (v_product_id, v_uid, v_order_id, v_rating, case
        when v_rating <= 2 then 'Sample review seeded for catalog preview - okay, but had some issues with quality.'
        when v_rating = 3 then 'Sample review seeded for catalog preview - decent, does the job.'
        else 'Sample review seeded for catalog preview - good quality, easy to resell.'
      end);
      perform public.switch_back_to_admin();
      v_reviews_added := v_reviews_added + 1;
    end if;
  end loop;

  return jsonb_build_object('added', v_added, 'updated', v_updated, 'reviews_added', v_reviews_added);
end;
$function$;
