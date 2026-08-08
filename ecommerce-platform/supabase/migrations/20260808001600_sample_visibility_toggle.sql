-- Requested directly: samples should be toggleable on/off rather than
-- only delete-and-reseed. "Off" hides them from Reseller/Merchant by
-- flipping the same is_active flag every existing query already
-- filters on (Catalog.jsx, MerchantStore.jsx, ResellerStorefront.jsx
-- all already `.eq('is_active', true)`; get_clinic_merchants_with_
-- services() already filters `cs.is_active = true`) -- no new
-- filtering logic needed anywhere else, just flip the flag admin-side.
create or replace function public.admin_toggle_sample_visibility(p_visible boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_products_updated int;
  v_services_updated int;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select lower(email) into v_email from auth.users where id = v_uid;
  if v_email is distinct from 'nolascoaubrey32@gmail.com' then raise exception 'NOT_PERMITTED'; end if;

  with updated as (
    update public.products set is_active = p_visible, updated_at = now()
    where merchant_id = v_uid and sku like 'JOM-SAMPLE-%'
    returning 1
  )
  select count(*) into v_products_updated from updated;

  with updated as (
    update public.clinic_services set is_active = p_visible, updated_at = now()
    where merchant_id = v_uid
    returning 1
  )
  select count(*) into v_services_updated from updated;

  return jsonb_build_object('products_updated', v_products_updated, 'services_updated', v_services_updated);
end;
$function$;

-- Additive: admin_delete_sample_catalog() never cleaned up
-- clinic_services (it was written before sample services existed) --
-- now it does, same hardcoded-admin scoping as everything else in
-- this function.
create or replace function public.admin_delete_sample_catalog()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_orders_deleted int;
  v_products_deleted int;
  v_services_deleted int;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select lower(email) into v_email from auth.users where id = v_uid;
  if v_email is distinct from 'nolascoaubrey32@gmail.com' then raise exception 'NOT_PERMITTED'; end if;

  with deleted as (delete from public.orders where reseller_id = v_uid and merchant_id = v_uid and notes = 'SAMPLE_CATALOG_SEED' returning 1)
  select count(*) into v_orders_deleted from deleted;

  with deleted as (delete from public.products where merchant_id = v_uid and sku like 'JOM-SAMPLE-%' returning 1)
  select count(*) into v_products_deleted from deleted;

  with deleted as (delete from public.clinic_services where merchant_id = v_uid returning 1)
  select count(*) into v_services_deleted from deleted;

  return jsonb_build_object('orders_deleted', v_orders_deleted, 'products_deleted', v_products_deleted, 'services_deleted', v_services_deleted);
end;
$function$;
