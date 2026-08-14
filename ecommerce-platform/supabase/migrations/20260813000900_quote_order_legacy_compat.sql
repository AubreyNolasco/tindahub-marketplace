-- URGENT PRODUCTION FIX: the currently-deployed frontend (main branch,
-- not yet merged with this branch's checkout rewrite) still calls
-- quote_order(p_merchant_id, p_items, p_shipping_fee, p_voucher_code) --
-- the old 4-arg signature. 20260813000400_automatic_shipping_checkout.sql
-- dropped that signature entirely and replaced it with a 5-arg version
-- (p_delivery_latitude/p_delivery_longitude instead of p_shipping_fee),
-- with no compatibility overload left behind. Unlike place_order's
-- wrappers (place_receiver_shipping_order etc, which appended the new
-- params with defaults and stayed callable with old argument lists),
-- quote_order had no bridge -- so every checkout page load on the live
-- (main-branch) production frontend has been failing with "Could not
-- find the function public.quote_order(p_items, p_merchant_id,
-- p_shipping_fee, p_voucher_code) in the schema cache" since that
-- migration went live. Reported live by the owner on 2026-08-13.
--
-- Fix: restore the old 4-arg signature as a thin compatibility overload.
-- It ignores the client-supplied p_shipping_fee entirely (never trust a
-- client-sent fee -- same rule the rest of this refactor follows) and
-- delegates to the new 5-arg quote_order with null delivery coordinates,
-- which is exactly what the old frontend already expects: no automatic
-- shipping in the preview, just subtotal/reseller_fee/total. Drop this
-- overload once the checkout-rewrite frontend (this branch) is merged
-- and deployed to production -- it exists only to keep the currently-live
-- frontend working in the meantime.

create or replace function public.quote_order(
  p_merchant_id uuid, p_items jsonb, p_shipping_fee numeric, p_voucher_code text default null
)
returns jsonb language sql stable security definer set search_path = public as $$
  select public.quote_order(p_merchant_id, p_items, null::numeric, null::numeric, p_voucher_code)
$$;

grant execute on function public.quote_order(uuid, jsonb, numeric, text) to authenticated;

notify pgrst, 'reload schema';
