-- Checkout hardening found during the full-system audit.
--
-- place_order() is the private money/stock primitive. A later five-argument
-- voucher overload was created without revoking PostgreSQL's default PUBLIC
-- EXECUTE privilege, and the legacy customer wrapper was still callable.
-- Keep the two address-validating receiver wrappers as the only public order
-- entry points. Also reject duplicate product lines before place_order() so a
-- crafted RPC payload cannot pass each per-line stock check and deduct the
-- same product twice into negative inventory.

revoke all on function public.place_order(uuid, text, jsonb, numeric) from public, anon, authenticated;
revoke all on function public.place_order(uuid, text, jsonb, numeric, text) from public, anon, authenticated;
revoke all on function public.place_customer_order(uuid, uuid, text, jsonb) from public, anon, authenticated;

create or replace function public.place_receiver_shipping_order(
  p_merchant_id uuid,
  p_shipping_address text,
  p_items jsonb,
  p_voucher_code text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_merchant_address text;
  v_buyer_address text;
  v_buyer_role public.user_role;
  v_account_status public.account_status;
  v_item jsonb;
  v_product_ids uuid[] := '{}';
  v_product_id uuid;
  v_quantity integer;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select role, account_status, address
    into v_buyer_role, v_account_status, v_buyer_address
  from public.profiles where id = auth.uid();

  if v_buyer_role not in ('merchant', 'reseller') then raise exception 'ORDER_ROLE_NOT_ALLOWED'; end if;
  if v_account_status <> 'approved'
     and not (v_buyer_role = 'merchant' and public.merchant_has_operate_grace(auth.uid()))
  then raise exception 'ACCOUNT_NOT_APPROVED'; end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'EMPTY_CART'; end if;
  if jsonb_array_length(p_items) > 100 then raise exception 'TOO_MANY_ORDER_ITEMS'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object'
       or coalesce(v_item->>'product_id', '') !~ '^[0-9a-fA-F-]{36}$'
       or coalesce(v_item->>'quantity', '') !~ '^[1-9][0-9]*$'
    then raise exception 'INVALID_ORDER_ITEM'; end if;
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    if v_product_id = any(v_product_ids) then raise exception 'DUPLICATE_CART_ITEM'; end if;
    v_product_ids := array_append(v_product_ids, v_product_id);
    if v_quantity > 100000 then raise exception 'INVALID_QUANTITY'; end if;
  end loop;

  select business_address into v_merchant_address
  from public.merchant_profiles where id = p_merchant_id and status = 'approved';
  if v_merchant_address is null then raise exception 'MERCHANT_UNAVAILABLE'; end if;

  if v_buyer_role = 'merchant' then
    select business_address into v_buyer_address from public.merchant_profiles where id = auth.uid();
  end if;
  if char_length(trim(coalesce(v_buyer_address, ''))) < 20 or v_buyer_address not like '%,%,%'
  then raise exception 'ACCOUNT_ADDRESS_INCOMPLETE'; end if;
  if char_length(trim(coalesce(v_merchant_address, ''))) < 20
     or char_length(trim(coalesce(p_shipping_address, ''))) < 20
     or v_merchant_address not like '%,%,%'
     or p_shipping_address not like '%,%,%'
  then raise exception 'INCOMPLETE_ADDRESS'; end if;

  v_order := public.place_order(p_merchant_id, p_shipping_address, p_items, 0, p_voucher_code);
  update public.orders set
    shipping_fee = 0,
    shipping_rate_source = 'Receiver pays actual shipping upon delivery',
    shipping_payment_method = 'receiver_pays_on_delivery',
    shipping_payment_status = 'pay_on_delivery',
    shipping_vehicle = null,
    shipping_distance_km = null
  where id = v_order.id returning * into v_order;
  return v_order;
end;
$$;

revoke all on function public.place_receiver_shipping_order(uuid, text, jsonb, text) from public, anon;
grant execute on function public.place_receiver_shipping_order(uuid, text, jsonb, text) to authenticated;

-- This wrapper keeps its existing customer ownership/address checks and calls
-- the hardened receiver wrapper above. Revoke PUBLIC explicitly as defense in depth.
revoke all on function public.place_customer_receiver_shipping_order(uuid, uuid, text, jsonb, text) from public, anon;
grant execute on function public.place_customer_receiver_shipping_order(uuid, uuid, text, jsonb, text) to authenticated;

notify pgrst, 'reload schema';
