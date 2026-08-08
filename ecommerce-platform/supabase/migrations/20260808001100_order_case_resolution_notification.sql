-- A different flavor of the same gap found four times already today:
-- order_cases already has a derived feed in RoleNotifications.jsx
-- (status in 'open'/'merchant_review'/'admin_review', for whichever
-- role owns the order), but once review_order_case() resolves or
-- rejects a case, that same status filter makes it disappear from
-- both parties' feeds -- nobody who opened a dispute ever gets told
-- the outcome, it just silently stops showing up as "needs attention".
-- Notifies opened_by specifically (the person actually waiting for an
-- answer), not every order stakeholder -- a merchant/admin resolving
-- a case they were already handling doesn't need to be told about
-- their own action.
create or replace function public.review_order_case(p_case_id uuid, p_approve boolean, p_notes text default null::text)
returns order_cases
language plpgsql
security definer
set search_path to 'public'
as $function$
declare c public.order_cases; o public.orders; result public.order_cases;
begin
  select * into c from public.order_cases where id=p_case_id for update;
  select * into o from public.orders where id=c.order_id;
  if c.id is null then raise exception 'CASE_NOT_FOUND'; end if;
  if not public.is_admin() and not(o.merchant_id=auth.uid() and c.status='merchant_review' and c.case_type='cancellation') then raise exception 'CASE_REVIEW_DENIED'; end if;
  if p_approve and c.case_type='cancellation' then perform set_config('app.case_resolution','true',true); update public.orders set status='cancelled' where id=o.id and status in('confirmed','processing','shipped'); end if;
  update public.order_cases set status=case when p_approve then 'resolved' else 'rejected' end,resolution_notes=left(trim(coalesce(p_notes,'')),1000),resolved_by=auth.uid(),resolved_at=now(),updated_at=now() where id=c.id returning * into result;

  if result.opened_by is not null then
    perform public.create_notification(
      result.opened_by, 'order_case',
      format('%s request %s', initcap(result.case_type), case when p_approve then 'approved' else 'rejected' end),
      coalesce(nullif(trim(p_notes), ''), format('Your %s request for order %s was %s.', result.case_type, coalesce(o.order_number, ''), case when p_approve then 'approved' else 'rejected' end)),
      case when o.merchant_id = result.opened_by then '/merchant/orders' else '/reseller/orders' end,
      jsonb_build_object('order_id', result.order_id, 'case_id', result.id)
    );
  end if;

  return result;
end $function$;
