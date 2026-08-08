-- =====================================================================
-- Admin-triggerable sample catalog: "Add / Refresh Samples" + "Delete
-- Samples" for the Admin Demo Merchant account, so the owner can
-- preview marketplace UI changes (like the Shopee/Lazada-style product
-- card in TASK10.md) with real product images, ratings, and a sold-
-- count badge, without needing a second real account or fabricated
-- production data.
--
-- Mirrors reset_admin_demo_data()'s existing precedent (same hardcoded
-- admin-email check, same "this tooling targets exactly one demo
-- account" posture) rather than inventing a new authorization pattern.
--
-- Product upsert data is passed in from the client as jsonb, sourced
-- from the single existing src/config/sampleProducts.js — that stays
-- the one source of truth for what a "sample product" is; this
-- migration only adds the privileged-write plumbing around it.
-- =====================================================================

-- ---------------------------------------------------------------------
-- admin_seed_sample_catalog — upserts the given sample products under
-- the Admin Demo Merchant account, then seeds exactly one sold-count
-- anchor (a synthetic completed order) and one rating per product, so
-- the new rating/sold-count row on ProductCard has something to show.
--
-- Reviews require profiles.role = 'reseller' at insert time
-- (prepare_product_review()'s existing RESELLER_ONLY check) — rather
-- than weakening that rule, this briefly uses the same
-- switch_role_for_demo()/switch_back_to_admin() pair the UI's own
-- "Admin demo mode" already uses, inside this function's own
-- transaction. If anything below raises, the whole transaction rolls
-- back, including the role switch — it can never leave the account
-- stuck mid-switch the way a multi-step manual process could.
-- ---------------------------------------------------------------------
create or replace function public.admin_seed_sample_catalog(p_products jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_item jsonb;
  v_existing_id uuid;
  v_product_id uuid;
  v_order_id uuid;
  v_qty int;
  v_price numeric;
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
        merchant_id, sku, name, description, price, wholesale_price, suggested_retail_price,
        stock_quantity, min_order_qty, discount_tiers, packed_weight_kg, packed_length_cm,
        packed_width_cm, packed_height_cm, product_type, fragile, keep_upright, motorcycle_safe,
        images, is_active
      ) values (
        v_uid, v_item->>'sku', v_item->>'name', v_item->>'description',
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

      perform public.switch_role_for_demo('reseller');
      insert into public.product_reviews (product_id, reseller_id, order_id, rating, comment)
      values (v_product_id, v_uid, v_order_id, case when random() > 0.5 then 5 else 4 end, 'Sample review seeded for catalog preview - good quality, easy to resell.');
      perform public.switch_back_to_admin();
      v_reviews_added := v_reviews_added + 1;
    end if;
  end loop;

  return jsonb_build_object('added', v_added, 'updated', v_updated, 'reviews_added', v_reviews_added);
end;
$$;

revoke all on function public.admin_seed_sample_catalog(jsonb) from public, anon;
grant execute on function public.admin_seed_sample_catalog(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- admin_delete_sample_catalog — removes exactly what the function above
-- adds: the SAMPLE_ skus and their seeded sold-count/review anchors.
-- Deletes the tagged orders first (order_items, product_reviews, and
-- purchase_orders all cascade off orders.id), then the products.
-- ---------------------------------------------------------------------
create or replace function public.admin_delete_sample_catalog()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_orders_deleted int;
  v_products_deleted int;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select lower(email) into v_email from auth.users where id = v_uid;
  if v_email is distinct from 'nolascoaubrey32@gmail.com' then raise exception 'NOT_PERMITTED'; end if;

  with deleted as (delete from public.orders where reseller_id = v_uid and merchant_id = v_uid and notes = 'SAMPLE_CATALOG_SEED' returning 1)
  select count(*) into v_orders_deleted from deleted;

  with deleted as (delete from public.products where merchant_id = v_uid and sku like 'JOM-SAMPLE-%' returning 1)
  select count(*) into v_products_deleted from deleted;

  return jsonb_build_object('orders_deleted', v_orders_deleted, 'products_deleted', v_products_deleted);
end;
$$;

revoke all on function public.admin_delete_sample_catalog() from public, anon;
grant execute on function public.admin_delete_sample_catalog() to authenticated;

notify pgrst, 'reload schema';
