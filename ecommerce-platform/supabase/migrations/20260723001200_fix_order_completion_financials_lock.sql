-- BUG: no Reseller could ever confirm delivery. compute_order_platform_fee()
-- (trg_compute_order_fee) recomputes new.platform_fee whenever a reseller
-- order transitions to 'completed'. lock_order_financials()
-- (trg_lock_order_financials) then sees platform_fee changed from the value
-- set at checkout and raises ORDER_FINANCIALS_LOCKED, blocking the very
-- same update that legitimately triggered the recompute. Both are BEFORE
-- UPDATE triggers, so trg_compute_order_fee (alphabetically first) always
-- runs before trg_lock_order_financials, guaranteeing the conflict on every
-- completion attempt.
--
-- platform_fee is never sent by the client (PurchaseHistory.jsx only PATCHes
-- status + delivered_at) — it is exclusively a server-computed value, so it
-- does not need to be in the client-tamper-protection list. Excluding it
-- here still fully protects total/subtotal/shipping_fee/reseller_operation_fee/
-- merchant_gross_amount/merchant_net_amount/fee_rate_snapshot/reseller_id/
-- merchant_id from being set directly by a non-admin PATCH body.
create or replace function public.lock_order_financials()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and not public.is_admin() and (
    new.total is distinct from old.total or new.subtotal is distinct from old.subtotal or
    new.shipping_fee is distinct from old.shipping_fee or new.reseller_operation_fee is distinct from old.reseller_operation_fee or
    new.merchant_gross_amount is distinct from old.merchant_gross_amount or
    new.merchant_net_amount is distinct from old.merchant_net_amount or new.fee_rate_snapshot is distinct from old.fee_rate_snapshot or
    new.reseller_id is distinct from old.reseller_id or new.merchant_id is distinct from old.merchant_id
  ) then raise exception 'ORDER_FINANCIALS_LOCKED'; end if;
  return new;
end $$;
