-- Companion to 20260808001100 (case *resolution* notification): the
-- opening side of the same gap. A newly-opened case only surfaced to
-- the merchant through RoleNotifications.jsx's derived orders feed,
-- which is status- and recency-limited (merchant_id's 10 most recent
-- orders in confirmed/processing/shipped) -- a case opened on an
-- 11th-most-recent order, or logged while that filter briefly misses
-- it, would sit in the merchant's actual review queue with no signal
-- reaching them at all.
--
-- Scoped narrowly to the one case that's unambiguously actionable by
-- a single, notifiable party: case_type='cancellation' landing
-- straight in 'merchant_review' status (open_order_case()'s own
-- branching -- everything else starts in 'admin_review', which is a
-- different, larger question about whether Admin should have a
-- notification bell at all, not a one-line addition to match).
create or replace function public.open_order_case(p_order_id uuid, p_case_type text, p_reason text, p_evidence_url text default null::text)
returns order_cases
language plpgsql
security definer
set search_path to 'public'
as $function$
declare o public.orders; result public.order_cases;
begin
  select * into o from public.orders where id=p_order_id;
  if o.id is null or auth.uid() not in(o.reseller_id,o.merchant_id) then raise exception 'ORDER_ACCESS_DENIED'; end if;
  if o.status in('completed','cancelled') and p_case_type='cancellation' then raise exception 'ORDER_CANNOT_BE_CANCELLED'; end if;
  if p_case_type not in('cancellation','dispute','return','replacement','refund') then raise exception 'INVALID_CASE_TYPE'; end if;
  insert into public.order_cases(order_id,opened_by,case_type,status,reason,evidence_url)
  values(o.id,auth.uid(),p_case_type,case when p_case_type='cancellation' and o.status='confirmed' then 'merchant_review' else 'admin_review' end,left(trim(p_reason),1000),nullif(trim(p_evidence_url),'')) returning * into result;

  if result.status = 'merchant_review' and o.merchant_id is not null and o.merchant_id != auth.uid() then
    perform public.create_notification(
      o.merchant_id, 'order_case',
      'Cancellation request needs your review',
      format('A cancellation was requested for order %s.', coalesce(o.order_number, '')),
      '/merchant/orders',
      jsonb_build_object('order_id', o.id, 'case_id', result.id)
    );
  end if;

  return result;
end $function$;
