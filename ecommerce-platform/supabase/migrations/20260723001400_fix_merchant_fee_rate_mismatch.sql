-- BUG: compute_order_platform_fee() recomputed platform_fee at 10% of order
-- total when a reseller order reached 'completed', silently overriding the
-- 3% merchant_success_fee_percent already charged at checkout by
-- place_order(). The merchant-facing order summary still labeled this
-- "3% Merchant Success Fee" and displayed the original 3% payout estimate
-- (e.g. P523.80), while the wallet was actually credited using the 10%
-- figure (P490.86) — a silent ~P33 shortfall never disclosed in the UI.
--
-- platform_fee is already correctly set once at checkout time (place_order)
-- using the configured merchant_success_fee_percent, and is protected from
-- tampering afterward. Recomputing it again on completion serves no purpose
-- and is the source of the mismatch, so this stops overwriting it and just
-- passes the row through unchanged.
create or replace function public.compute_order_platform_fee()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  return new;
end;
$$;
