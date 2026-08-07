-- Correction: 20260807000500 added a shipped-before-completion check to
-- lock_order_financials() based on an audit finding that turned out to
-- be a false positive -- caused by a truncated `grep ... | head -30`
-- during the audit that cut off before reaching
-- security_hardening_migration.sql, where public.enforce_order_transition()
-- already lives. That trigger (trg_enforce_order_transition, fires
-- BEFORE trg_lock_order_financials on the same event -- same-event
-- triggers run in name order, and 'enforce' < 'lock') already
-- whitelists every legal non-admin status transition explicitly:
-- merchant payment_review->confirmed/cancelled, confirmed->processing,
-- processing->shipped; reseller shipped->completed and nothing else --
-- raising INVALID_ORDER_STATUS_TRANSITION for anything not on that
-- list. A reseller could never reach 'completed' except from 'shipped'
-- even before 20260807000500, and could never self-cancel via this
-- path at all. 20260807000500's additions were therefore always dead
-- code (unreachable -- enforce_order_transition rejects first), not a
-- fix. Reverting lock_order_financials() to its pre-20260807000500
-- state to remove that dead/confusing duplicate logic. No behavior
-- change results from this revert, by the same reasoning.

create or replace function public.lock_order_financials()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.total is distinct from old.total or new.subtotal is distinct from old.subtotal or
       new.shipping_fee is distinct from old.shipping_fee or new.reseller_operation_fee is distinct from old.reseller_operation_fee or
       new.platform_fee is distinct from old.platform_fee or new.merchant_gross_amount is distinct from old.merchant_gross_amount or
       new.merchant_net_amount is distinct from old.merchant_net_amount or new.fee_rate_snapshot is distinct from old.fee_rate_snapshot or
       new.reseller_id is distinct from old.reseller_id or new.merchant_id is distinct from old.merchant_id
    then raise exception 'ORDER_FINANCIALS_LOCKED'; end if;
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';
