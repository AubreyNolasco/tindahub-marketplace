-- Phase 10 (cont.): found while wiring the voucher-code input into
-- Checkout.jsx. The frontend never calls place_order() directly -- it
-- calls place_receiver_shipping_order()/place_customer_receiver_shipping_order()
-- (shipping_engine_migration.sql), fixed-arity wrappers that hardcode
-- `place_order(p_merchant_id, p_shipping_address, p_items, 0)` with no
-- voucher param. 20260806001900_checkout_voucher_integration.sql added
-- p_voucher_code to quote_order()/place_order() but never touched these
-- two wrappers, so a voucher applied at checkout would show correctly
-- in the price preview (quote_order) and then silently NOT be applied
-- at the actual money-moving step (place_order via the wrapper) -- the
-- exact "shopper sees a discount, gets charged full price" bug class
-- this project's Phase 1 already flagged as a live financial-trust bug
-- once before (see TASK6.md Phase 1/9), just in the voucher feature
-- instead of campaigns this time.
--
-- Dropped and recreated (not overloaded) so every existing caller that
-- doesn't pass p_voucher_code keeps working unchanged, per this
-- project's forward-only/backward-compatible migration rule.

drop function if exists public.place_receiver_shipping_order(uuid, text, jsonb);
drop function if exists public.place_customer_receiver_shipping_order(uuid, uuid, text, jsonb);

create or replace function public.place_receiver_shipping_order(p_merchant_id uuid, p_shipping_address text, p_items jsonb, p_voucher_code text default null)
returns public.orders language plpgsql security definer set search_path = public as $$
declare v_order public.orders; v_merchant_address text; v_buyer_address text; v_buyer_role user_role;
begin
  select business_address into v_merchant_address from public.merchant_profiles where id = p_merchant_id;
  select role, address into v_buyer_role, v_buyer_address from public.profiles where id = auth.uid();
  if v_buyer_role = 'merchant' then select business_address into v_buyer_address from public.merchant_profiles where id = auth.uid(); end if;
  if char_length(trim(coalesce(v_buyer_address,''))) < 20 or v_buyer_address not like '%,%,%' then raise exception 'ACCOUNT_ADDRESS_INCOMPLETE'; end if;
  if char_length(trim(coalesce(v_merchant_address,''))) < 20 or char_length(trim(coalesce(p_shipping_address,''))) < 20 or v_merchant_address not like '%,%,%' or p_shipping_address not like '%,%,%' then raise exception 'INCOMPLETE_ADDRESS'; end if;
  v_order := public.place_order(p_merchant_id, p_shipping_address, p_items, 0, p_voucher_code);
  update public.orders set shipping_fee = 0, shipping_rate_source = 'Receiver pays actual shipping upon delivery', shipping_payment_method = 'receiver_pays_on_delivery', shipping_payment_status = 'pay_on_delivery', shipping_vehicle = null, shipping_distance_km = null where id = v_order.id returning * into v_order;
  return v_order;
end; $$;

create or replace function public.place_customer_receiver_shipping_order(p_merchant_id uuid, p_customer_id uuid, p_shipping_address text, p_items jsonb, p_voucher_code text default null)
returns public.orders language plpgsql security definer set search_path = public as $$
declare v_order public.orders; v_customer public.customers;
begin
  select * into v_customer from public.customers where id = p_customer_id and reseller_id = auth.uid(); if v_customer is null then raise exception 'INVALID_CUSTOMER'; end if;
  if lower(trim(v_customer.address)) <> lower(trim(p_shipping_address)) then raise exception 'CUSTOMER_ADDRESS_MISMATCH'; end if;
  v_order := public.place_receiver_shipping_order(p_merchant_id, p_shipping_address, p_items, p_voucher_code);
  perform set_config('app.assigning_order_customer', 'true', true); update public.orders set customer_id = v_customer.id where id = v_order.id returning * into v_order; perform set_config('app.assigning_order_customer', 'false', true);
  return v_order;
end; $$;

grant execute on function public.place_receiver_shipping_order(uuid, text, jsonb, text) to authenticated;
grant execute on function public.place_customer_receiver_shipping_order(uuid, uuid, text, jsonb, text) to authenticated;

notify pgrst, 'reload schema';
