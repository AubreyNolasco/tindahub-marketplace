-- TASK11.md "Gap 2" — merchants had no way to request a real courier
-- vehicle (e.g. a car for a bulky order) from Lalamove; every quote/booking
-- was hardcoded to MOTORCYCLE regardless of what the merchant actually
-- needs to ship. This does NOT change what the customer is charged — the
-- automatic platform estimate from the shipping/address refactor
-- (calculate_standard_shipping, motorcycle/sedan tiers) stays fixed at
-- order time and is never re-billed, same as how Shopee/Lazada shipping
-- estimates work. This only affects the merchant's own courier booking,
-- which is a fulfillment-cost decision, not a customer-facing one.
--
-- delivery_service_type is set once, at propose_order_shipping_fee time
-- (when the merchant gets an automatic delivery quote in
-- ShippingFeeModal.jsx), and read back by delivery-book when it re-quotes
-- and books moments after the Reseller accepts — so the booked vehicle
-- matches what the merchant actually quoted, not whatever the adapter's
-- default happens to be.

alter table public.orders add column if not exists delivery_service_type text;

drop function if exists public.propose_order_shipping_fee(uuid, numeric, text, text, uuid);
create function public.propose_order_shipping_fee(
  p_order_id uuid,
  p_fee numeric,
  p_note text default null,
  p_lalamove_quotation_id text default null,
  p_delivery_quote_account_id uuid default null,
  p_delivery_service_type text default null
)
returns public.orders language plpgsql security definer set search_path=public as $$
declare result public.orders;
begin
  if p_fee is null or p_fee < 0 then raise exception 'VALID_SHIPPING_FEE_REQUIRED'; end if;
  if p_delivery_service_type is not null and p_delivery_service_type not in ('MOTORCYCLE', 'CAR') then
    raise exception 'INVALID_DELIVERY_SERVICE_TYPE';
  end if;
  update public.orders set proposed_shipping_fee=round(p_fee,2),shipping_fee_confirmation_status='pending',
    shipping_fee_merchant_note=nullif(left(trim(coalesce(p_note,'')),500),''),shipping_fee_reseller_note=null,
    lalamove_quote_id=nullif(trim(coalesce(p_lalamove_quotation_id,'')),''),
    delivery_quote_account_id=p_delivery_quote_account_id,
    delivery_service_type=p_delivery_service_type,
    shipping_fee_proposed_at=now(),shipping_fee_responded_at=null,updated_at=now()
  where id=p_order_id and merchant_id=auth.uid() and status='processing' and shipping_payment_method='receiver_pays_on_delivery'
  returning * into result;
  if result.id is null then raise exception 'ORDER_NOT_READY_FOR_SHIPPING_FEE'; end if;
  return result;
end $$;

grant execute on function public.propose_order_shipping_fee(uuid,numeric,text,text,uuid,text) to authenticated;

notify pgrst, 'reload schema';
