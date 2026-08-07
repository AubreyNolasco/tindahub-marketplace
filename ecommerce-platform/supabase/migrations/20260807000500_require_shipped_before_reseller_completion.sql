-- Closes the third finding from the 2026-08-07 security audit (see
-- TASKS.md): orders_reseller_update's RLS only checks reseller_id =
-- auth.uid(), and handle_order_status_change() releases the merchant's
-- escrowed payout on any transition into 'completed' from
-- confirmed/processing/shipped -- with nothing stopping a reseller from
-- confirming receipt the instant an order is placed, before the
-- merchant has shipped anything. The buyer self-completing IS the
-- intended "Confirm Received" design (see order_wallet_escrow_migration.sql's
-- own comment: "only the buyer... may set an order to completed"), so
-- this doesn't remove that -- it just requires the order to have
-- actually reached 'shipped' first, closing the "skip straight to
-- completed and release the payout with nothing ever sent" window.
--
-- Symmetric fix for self-cancellation: once an order reaches 'shipped',
-- a reseller-initiated cancel-for-refund is no longer a simple RLS
-- self-service action -- past that point, `order_cases` (the existing
-- dispute/case flow, statuses open/merchant_review/admin_review) is the
-- correct channel, same as the rest of the app already models
-- post-shipment problems. Before 'shipped' (confirmed/processing),
-- self-cancellation is unchanged.
--
-- Both checks reuse lock_order_financials(), the existing BEFORE UPDATE
-- guard trigger on orders for non-admins, rather than adding a second
-- trigger for the same event.

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

    if new.status = 'completed' and old.status is distinct from new.status and old.status <> 'shipped' then
      raise exception 'ORDER_MUST_BE_SHIPPED_BEFORE_COMPLETION';
    end if;

    if new.status = 'cancelled' and old.status is distinct from new.status and old.status not in ('payment_review', 'confirmed', 'processing') then
      raise exception 'SHIPPED_ORDER_CANNOT_SELF_CANCEL';
    end if;
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';
