alter table public.orders add column if not exists proposed_shipping_fee numeric(12,2) check(proposed_shipping_fee is null or proposed_shipping_fee >= 0);
alter table public.orders add column if not exists shipping_fee_confirmation_status text check(shipping_fee_confirmation_status is null or shipping_fee_confirmation_status in('pending','accepted','declined'));
alter table public.orders add column if not exists shipping_fee_merchant_note text;
alter table public.orders add column if not exists shipping_fee_reseller_note text;
alter table public.orders add column if not exists shipping_fee_proposed_at timestamptz;
alter table public.orders add column if not exists shipping_fee_responded_at timestamptz;

create or replace function public.propose_order_shipping_fee(p_order_id uuid,p_fee numeric,p_note text default null)
returns public.orders language plpgsql security definer set search_path=public as $$
declare result public.orders;
begin
  if p_fee is null or p_fee < 0 then raise exception 'VALID_SHIPPING_FEE_REQUIRED'; end if;
  update public.orders set proposed_shipping_fee=round(p_fee,2),shipping_fee_confirmation_status='pending',
    shipping_fee_merchant_note=nullif(left(trim(coalesce(p_note,'')),500),''),shipping_fee_reseller_note=null,
    shipping_fee_proposed_at=now(),shipping_fee_responded_at=null,updated_at=now()
  where id=p_order_id and merchant_id=auth.uid() and status='processing' and shipping_payment_method='receiver_pays_on_delivery'
  returning * into result;
  if result.id is null then raise exception 'ORDER_NOT_READY_FOR_SHIPPING_FEE'; end if;
  return result;
end $$;

create or replace function public.respond_order_shipping_fee(p_order_id uuid,p_accept boolean,p_note text default null)
returns public.orders language plpgsql security definer set search_path=public as $$
declare result public.orders;
begin
  if not p_accept and char_length(trim(coalesce(p_note,''))) < 5 then raise exception 'DECLINE_NOTE_REQUIRED'; end if;
  update public.orders set shipping_fee_confirmation_status=case when p_accept then 'accepted' else 'declined' end,
    shipping_fee_reseller_note=nullif(left(trim(coalesce(p_note,'')),500),''),shipping_fee_responded_at=now(),updated_at=now()
  where id=p_order_id and reseller_id=auth.uid() and status='processing' and shipping_fee_confirmation_status='pending'
  returning * into result;
  if result.id is null then raise exception 'SHIPPING_FEE_NOT_AWAITING_RESPONSE'; end if;
  return result;
end $$;

create or replace function public.set_order_delivery(p_order_id uuid,p_provider text,p_tracking text,p_pickup timestamptz,p_estimated timestamptz,p_proof_url text,p_actual_fee numeric default null)
returns public.orders language plpgsql security definer set search_path=public as $$
declare result public.orders;
begin
  if char_length(trim(coalesce(p_provider,'')))<2 or char_length(trim(coalesce(p_tracking,'')))<3 then raise exception 'DELIVERY_DETAILS_REQUIRED'; end if;
  update public.orders set delivery_provider=left(trim(p_provider),120),tracking_number=left(trim(p_tracking),120),pickup_scheduled_at=p_pickup,
    estimated_delivery_at=p_estimated,dispatch_proof_url=nullif(trim(p_proof_url),''),actual_shipping_fee=proposed_shipping_fee,
    shipped_at=now(),auto_complete_at=greatest(coalesce(p_estimated,now()),now())+interval '7 days',status='shipped'
  where id=p_order_id and merchant_id=auth.uid() and status='processing'
    and shipping_fee_confirmation_status='accepted' and proposed_shipping_fee is not null returning * into result;
  if result.id is null then raise exception 'RESELLER_SHIPPING_CONFIRMATION_REQUIRED'; end if;
  return result;
end $$;

create or replace function public.enforce_shipping_fee_before_dispatch()
returns trigger language plpgsql set search_path=public as $$
begin
  if old.status='processing' and new.status='shipped' and (old.shipping_fee_confirmation_status is distinct from 'accepted' or old.proposed_shipping_fee is null) then
    raise exception 'RESELLER_SHIPPING_CONFIRMATION_REQUIRED';
  end if;
  return new;
end $$;
drop trigger if exists trg_shipping_fee_before_dispatch on public.orders;
create trigger trg_shipping_fee_before_dispatch before update of status on public.orders for each row execute function public.enforce_shipping_fee_before_dispatch();

grant execute on function public.propose_order_shipping_fee(uuid,numeric,text),public.respond_order_shipping_fee(uuid,boolean,text) to authenticated;
notify pgrst,'reload schema';
