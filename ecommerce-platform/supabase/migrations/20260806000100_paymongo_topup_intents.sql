-- =====================================================================
-- PayMongo online top-up — additive only.
--
-- Reuses the EXISTING manual top-up path end to end: a PayMongo top-up
-- still creates a normal public.topup_requests row, and the existing
-- handle_topup_approved() trigger (from topup_wallet_migration.sql)
-- still does the wallet crediting when status flips to 'approved' — the
-- webhook handler below only ever sets that same status column, exactly
-- like an admin clicking Approve in TopupRequests.jsx does today. No
-- existing table, trigger, RPC, or RLS policy is modified.
--
-- Manual top-up (screenshot + admin review) is untouched and stays the
-- only path whenever payments.paymongo is disabled or has no
-- credentials — see is_integration_enabled() below, which the frontend
-- checks before ever offering the online option.
-- =====================================================================

-- 'paymongo' is a new payment_method so a PayMongo top-up shows up in the
-- existing admin queue/reports like any other method, distinguishable
-- from the manual gcash/maya/bank_transfer rows.
do $$ begin
  alter type public.payment_method add value if not exists 'paymongo';
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- payment_intents — maps a topup_requests row to the PayMongo checkout
-- session that will (if paid) flip it to 'approved'. Generic on
-- provider_key so a future Maya/GCash/Stripe intent can reuse the same
-- table instead of each needing its own.
-- ---------------------------------------------------------------------
create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  topup_request_id uuid not null references public.topup_requests(id) on delete cascade,
  provider_key text not null references public.integration_configs(key),
  external_ref text not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'expired')),
  checkout_url text,
  raw_payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists payment_intents_provider_ref_idx on public.payment_intents(provider_key, external_ref);
create index if not exists payment_intents_topup_idx on public.payment_intents(topup_request_id);

alter table public.payment_intents enable row level security;

drop policy if exists "payment_intents_owner_read" on public.payment_intents;
create policy "payment_intents_owner_read" on public.payment_intents
  for select to authenticated using (
    exists (select 1 from public.topup_requests t where t.id = topup_request_id and t.owner_id = auth.uid())
    or public.is_admin()
  );

-- Writes only from edge functions on the service_role key (paymongo-create-intent,
-- paymongo-webhook), same convention as lalamove_bookings/lalamove_webhook_events.
revoke insert, update, delete on public.payment_intents from authenticated, anon;
grant select on public.payment_intents to authenticated;
grant select, insert, update on public.payment_intents to service_role;

-- ---------------------------------------------------------------------
-- is_integration_enabled — lets any authenticated user (not just admins)
-- check whether an integration is turned on, without exposing
-- credentials. get_integration_configs() already does this but is
-- admin-only (RLS on integration_configs requires is_admin()), which is
-- correct for the Settings screen but too restrictive for "should the
-- Reseller/Merchant top-up modal show a Pay Online button" — that's a
-- boolean UI decision, not a secret.
-- ---------------------------------------------------------------------
create or replace function public.is_integration_enabled(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select enabled from public.integration_configs where key = p_key), false);
$$;

revoke all on function public.is_integration_enabled(text) from public, anon;
grant execute on function public.is_integration_enabled(text) to authenticated;

notify pgrst, 'reload schema';
