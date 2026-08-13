-- Fixes a real bug introduced by 20260813000400_automatic_shipping_checkout.sql:
-- an order priced automatically (shipping_payment_method = 'prepaid_wallet')
-- never gets shipping_fee_confirmation_status/proposed_shipping_fee set,
-- since that pair is only ever written by the manual negotiation flow
-- (propose_order_shipping_fee/respond_order_shipping_fee). Both the
-- dispatch trigger and set_order_delivery() required that pair before this
-- migration, so a merchant had no way to mark an automatically-priced
-- order as shipped at all -- the default path for every new order where
-- both pins exist and the cart fits standard limits. See TASK11.md "Gap 1".
--
-- Fix: an order is dispatch-ready if EITHER the manual negotiation was
-- accepted OR the fee was already charged automatically at order time --
-- not only the former.

create or replace function public.enforce_shipping_fee_before_dispatch()
returns trigger language plpgsql set search_path=public as $$
begin
  if old.status='processing' and new.status='shipped'
     and old.shipping_payment_method is distinct from 'prepaid_wallet'
     and (old.shipping_fee_confirmation_status is distinct from 'accepted' or old.proposed_shipping_fee is null)
  then
    raise exception 'RESELLER_SHIPPING_CONFIRMATION_REQUIRED';
  end if;
  return new;
end $$;

create or replace function public.set_order_delivery(p_order_id uuid,p_provider text,p_tracking text,p_pickup timestamptz,p_estimated timestamptz,p_proof_url text,p_actual_fee numeric default null)
returns public.orders language plpgsql security definer set search_path=public as $$
declare result public.orders;
begin
  if char_length(trim(coalesce(p_provider,'')))<2 or char_length(trim(coalesce(p_tracking,'')))<3 then raise exception 'DELIVERY_DETAILS_REQUIRED'; end if;
  update public.orders set delivery_provider=left(trim(p_provider),120),tracking_number=left(trim(p_tracking),120),pickup_scheduled_at=p_pickup,
    estimated_delivery_at=p_estimated,dispatch_proof_url=nullif(trim(p_proof_url),''),actual_shipping_fee=coalesce(proposed_shipping_fee, shipping_fee),
    shipped_at=now(),auto_complete_at=greatest(coalesce(p_estimated,now()),now())+interval '7 days',status='shipped'
  where id=p_order_id and merchant_id=auth.uid() and status='processing'
    and (
      (shipping_fee_confirmation_status='accepted' and proposed_shipping_fee is not null)
      or shipping_payment_method='prepaid_wallet'
    )
    and (p_actual_fee is null or round(p_actual_fee,2)=coalesce(proposed_shipping_fee, shipping_fee))
  returning * into result;
  if result.id is null then raise exception 'RESELLER_SHIPPING_CONFIRMATION_REQUIRED'; end if;
  return result;
end $$;

notify pgrst, 'reload schema';
