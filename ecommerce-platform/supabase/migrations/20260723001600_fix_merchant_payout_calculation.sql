-- handle_order_status_change() computed the completion payout as
-- new.total - new.platform_fee. new.total includes the Reseller's 1%
-- operation fee (JOM HUB revenue from the Reseller side, not part of the
-- Merchant's product sale), so this overpaid the Merchant by that amount
-- versus the already-correct merchant_net_amount snapshot place_order()
-- computes at checkout (product_total - merchant_fee) and that
-- lock_order_financials() protects from tampering. The description text
-- also hardcoded "10% operation fee deducted" regardless of the actual
-- configured rate. Use the checkout-time snapshot and report the real fee.
create or replace function public.handle_order_status_change()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_wallet_id uuid;
  v_payout numeric(12,2);
begin
  if new.status = 'completed' and old.status in ('confirmed', 'processing', 'shipped') then
    v_payout := coalesce(nullif(new.merchant_net_amount, 0), new.subtotal - coalesce(new.platform_fee, 0));

    select id into v_wallet_id from public.wallets where owner_id = new.merchant_id;
    if v_wallet_id is null then
      insert into public.wallets (owner_id, balance) values (new.merchant_id, 0)
      returning id into v_wallet_id;
    end if;
    update public.wallets set balance = balance + v_payout, updated_at = now() where id = v_wallet_id;
    insert into public.wallet_transactions (wallet_id, amount, type, description, order_id)
    values (
      v_wallet_id, v_payout, 'credit',
      'Order ' || new.order_number || ' delivered - payout' ||
      case when coalesce(new.platform_fee, 0) > 0 then ' (merchant success fee deducted: ' || new.platform_fee || ')' else '' end,
      new.id
    );
  end if;

  if new.status = 'cancelled' and old.status in ('confirmed', 'processing', 'shipped') then
    select id into v_wallet_id from public.wallets where owner_id = new.reseller_id;
    if v_wallet_id is not null then
      update public.wallets set balance = balance + new.total, updated_at = now() where id = v_wallet_id;
      insert into public.wallet_transactions (wallet_id, amount, type, description, order_id)
      values (v_wallet_id, new.total, 'credit', 'Order ' || new.order_number || ' cancelled - refund', new.id);
    end if;
  end if;

  return new;
end;
$$;
