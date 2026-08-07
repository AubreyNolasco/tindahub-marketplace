-- =====================================================================
-- Stripe + PayPal online top-up — payment_method enum additions only.
--
-- 'maya' already exists in payment_method (manual Maya top-up has used
-- it since the original schema), so maya-create-intent's `method: 'maya'`
-- insert needs no new value — the online checkout is just an automated
-- path to the same payment method. Stripe and PayPal are genuinely new
-- methods, same as 'paymongo' was in 20260806000100_paymongo_topup_intents.sql.
--
-- payment_intents (provider_key/external_ref/status table) already
-- exists from that same migration and is generic across providers —
-- no new table needed here.
-- =====================================================================

do $$ begin
  alter type public.payment_method add value if not exists 'stripe';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type public.payment_method add value if not exists 'paypal';
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
