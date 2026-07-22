-- Assign a reseller-owned customer to an atomic wallet checkout.
create or replace function public.place_customer_order(
  p_merchant_id uuid,
  p_customer_id uuid,
  p_shipping_address text,
  p_items jsonb
)
returns public.orders language plpgsql security definer set search_path = public as $$
declare v_order public.orders; v_customer public.customers;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into v_customer from public.customers where id = p_customer_id and reseller_id = auth.uid();
  if v_customer is null then raise exception 'INVALID_CUSTOMER'; end if;
  if char_length(coalesce(v_customer.address, '')) < 5 then raise exception 'CUSTOMER_ADDRESS_REQUIRED'; end if;
  v_order := public.place_order(p_merchant_id, p_shipping_address, p_items, 0);
  perform set_config('app.assigning_order_customer', 'true', true);
  update public.orders set customer_id = v_customer.id where id = v_order.id returning * into v_order;
  perform set_config('app.assigning_order_customer', 'false', true);
  return v_order;
end; $$;
revoke all on function public.place_customer_order(uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.place_customer_order(uuid, uuid, text, jsonb) to authenticated;

-- Allow the controlled wrapper above to attach a validated customer. All direct
-- user attempts to alter customer/order identity remain blocked.
create or replace function public.protect_order_identity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('app.assigning_order_customer', true) = 'true' then return new; end if;
  if auth.uid() is not null and not public.is_admin() and (
    new.id is distinct from old.id or new.order_number is distinct from old.order_number or
    new.customer_id is distinct from old.customer_id or new.shipping_address is distinct from old.shipping_address or
    new.notes is distinct from old.notes or new.created_at is distinct from old.created_at
  ) then raise exception 'ORDER_IDENTITY_LOCKED'; end if;
  return new;
end; $$;

drop policy if exists "customers_order_merchant_read" on public.customers;
create policy "customers_order_merchant_read" on public.customers for select to authenticated using (
  exists (select 1 from public.orders where orders.customer_id = customers.id and orders.merchant_id = auth.uid())
);
