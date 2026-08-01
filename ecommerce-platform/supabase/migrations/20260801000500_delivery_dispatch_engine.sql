-- =====================================================================
-- Delivery Provider Engine — Phase 5
--
-- Generalizes the dispatch trigger from "was this quote Lalamove"
-- (orders.lalamove_quote_id) to "which delivery_provider_accounts row
-- produced this quote" (orders.delivery_quote_account_id). That row
-- carries the owner tier (Merchant/Reseller/Platform) and provider
-- code, so complete_lalamove_dispatch can record the real provider
-- name instead of hardcoding 'Lalamove', and delivery-book (the
-- generalized successor to lalamove-book) knows which credentials to
-- book with regardless of which tier won the quote.
--
-- orders.lalamove_quote_id is left in place (still populated, still
-- readable) — nothing currently reads it besides display, and dropping
-- it isn't necessary for this to work.
-- =====================================================================

alter table public.orders add column if not exists delivery_quote_account_id uuid references public.delivery_provider_accounts(id);
alter table public.lalamove_bookings add column if not exists provider_code text not null default 'lalamove';

-- ---------------------------------------------------------------------
-- propose_order_shipping_fee — new 5th param, backward compatible
-- (existing 4-arg named calls keep working since it's appended with a
-- default). Drop-then-create to match this repo's convention for this
-- function (see 20260729001100_lalamove_booking_pipeline.sql).
-- ---------------------------------------------------------------------
drop function if exists public.propose_order_shipping_fee(uuid, numeric, text, text);
create function public.propose_order_shipping_fee(
  p_order_id uuid,
  p_fee numeric,
  p_note text default null,
  p_lalamove_quotation_id text default null,
  p_delivery_quote_account_id uuid default null
)
returns public.orders language plpgsql security definer set search_path=public as $$
declare result public.orders;
begin
  if p_fee is null or p_fee < 0 then raise exception 'VALID_SHIPPING_FEE_REQUIRED'; end if;
  update public.orders set proposed_shipping_fee=round(p_fee,2),shipping_fee_confirmation_status='pending',
    shipping_fee_merchant_note=nullif(left(trim(coalesce(p_note,'')),500),''),shipping_fee_reseller_note=null,
    lalamove_quote_id=nullif(trim(coalesce(p_lalamove_quotation_id,'')),''),
    delivery_quote_account_id=p_delivery_quote_account_id,
    shipping_fee_proposed_at=now(),shipping_fee_responded_at=null,updated_at=now()
  where id=p_order_id and merchant_id=auth.uid() and status='processing' and shipping_payment_method='receiver_pays_on_delivery'
  returning * into result;
  if result.id is null then raise exception 'ORDER_NOT_READY_FOR_SHIPPING_FEE'; end if;
  return result;
end $$;

grant execute on function public.propose_order_shipping_fee(uuid,numeric,text,text,uuid) to authenticated;

-- ---------------------------------------------------------------------
-- complete_lalamove_dispatch — now takes which provider actually booked
-- it, and records that provider's real name instead of always 'Lalamove'.
-- ---------------------------------------------------------------------
drop function if exists public.complete_lalamove_dispatch(uuid, text, timestamptz, timestamptz);
create function public.complete_lalamove_dispatch(
  p_order_id uuid,
  p_lalamove_order_id text,
  p_provider_code text default 'lalamove',
  p_pickup timestamptz default null,
  p_estimated timestamptz default null
)
returns public.orders language plpgsql security definer set search_path=public as $$
declare result public.orders; v_provider_name text;
begin
  if char_length(trim(coalesce(p_lalamove_order_id,''))) < 1 then raise exception 'LALAMOVE_ORDER_ID_REQUIRED'; end if;
  select name into v_provider_name from public.delivery_providers where code = p_provider_code;
  perform set_config('app.operational_maintenance','true',true);
  update public.orders set delivery_provider=coalesce(v_provider_name, 'Lalamove'),tracking_number=left(trim(p_lalamove_order_id),120),
    pickup_scheduled_at=coalesce(p_pickup, now()),estimated_delivery_at=p_estimated,actual_shipping_fee=proposed_shipping_fee,
    shipped_at=now(),auto_complete_at=greatest(coalesce(p_estimated,now()),now())+interval '7 days',status='shipped'
  where id=p_order_id and status='processing' and shipping_fee_confirmation_status='accepted' and proposed_shipping_fee is not null
  returning * into result;
  if result.id is null then raise exception 'ORDER_NOT_READY_FOR_LALAMOVE_DISPATCH'; end if;
  return result;
end $$;

revoke all on function public.complete_lalamove_dispatch(uuid,text,text,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.complete_lalamove_dispatch(uuid,text,text,timestamptz,timestamptz) to service_role;

-- ---------------------------------------------------------------------
-- notify_lalamove_dispatch_ready — now fires on delivery_quote_account_id
-- (any tier/provider) instead of only lalamove_quote_id, and calls the
-- generalized delivery-book function instead of lalamove-book.
-- ---------------------------------------------------------------------
create or replace function public.notify_lalamove_dispatch_ready()
returns trigger language plpgsql security definer set search_path=public, vault, net as $$
declare v_secret text;
begin
  if new.shipping_fee_confirmation_status = 'accepted'
     and old.shipping_fee_confirmation_status is distinct from 'accepted'
     and new.delivery_quote_account_id is not null then
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'lalamove_dispatch_secret';
    if v_secret is not null then
      perform net.http_post(
        url := 'https://ttscpfsodrcyllyvvqzb.supabase.co/functions/v1/delivery-book',
        headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',v_secret),
        body := jsonb_build_object('order_id', new.id)
      );
    end if;
  end if;
  return new;
end $$;

-- Trigger definition itself is unchanged (same function slot), just
-- re-asserted for clarity.
drop trigger if exists trg_notify_lalamove_dispatch_ready on public.orders;
create trigger trg_notify_lalamove_dispatch_ready after update of shipping_fee_confirmation_status on public.orders
for each row execute function public.notify_lalamove_dispatch_ready();

notify pgrst, 'reload schema';
