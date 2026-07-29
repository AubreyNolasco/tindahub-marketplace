-- =====================================================================
-- Lalamove booking pipeline
-- 1. Encrypts lalamove_settings credentials with Supabase Vault (they were
--    plaintext columns, round-tripped to the reseller's browser on every
--    settings-page load).
-- 2. Adds lalamove_bookings (status history + idempotency guard) and
--    lalamove_webhook_events (raw callback audit log).
-- 3. Adds pickup/dropoff coordinates needed for real Lalamove stops.
-- 4. Wires automatic booking to the moment the Reseller accepts a
--    Lalamove-sourced shipping fee (not to merchant "confirm" — the item
--    isn't packed yet at that point), via net.http_post the same way
--    trigger_storage_retention_cleanup() already calls an edge function.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Vault-encrypted Lalamove credentials
-- ---------------------------------------------------------------------
alter table public.lalamove_settings add column if not exists api_key_secret_id uuid;
alter table public.lalamove_settings add column if not exists api_secret_secret_id uuid;

-- One-time backfill of any existing plaintext credentials into Vault.
do $$
declare r record;
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='lalamove_settings' and column_name='api_key') then
    for r in select id, api_key, api_secret from public.lalamove_settings where api_key is not null or api_secret is not null loop
      update public.lalamove_settings set
        api_key_secret_id = case when r.api_key is not null then vault.create_secret(r.api_key, 'lalamove_api_key_'||r.id::text) else null end,
        api_secret_secret_id = case when r.api_secret is not null then vault.create_secret(r.api_secret, 'lalamove_api_secret_'||r.id::text) else null end
      where id = r.id;
    end loop;
    alter table public.lalamove_settings drop column api_key;
    alter table public.lalamove_settings drop column api_secret;
  end if;
end $$;

-- Return type changes from the original public.lalamove_settings row
-- (which carried the raw secret) to jsonb — CREATE OR REPLACE can't change
-- a function's return type, so drop first.
drop function if exists public.save_lalamove_settings(text, text, text, boolean);
create function public.save_lalamove_settings(
  p_api_key text,
  p_api_secret text,
  p_market text default 'PH_MNL',
  p_is_enabled boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_owner_id uuid := auth.uid();
  v_existing public.lalamove_settings;
  v_key_id uuid;
  v_secret_id uuid;
begin
  if v_owner_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_existing from public.lalamove_settings where owner_id = v_owner_id;

  v_key_id := v_existing.api_key_secret_id;
  v_secret_id := v_existing.api_secret_secret_id;

  if p_api_key is not null and length(trim(p_api_key)) > 0 then
    if v_key_id is null then
      v_key_id := vault.create_secret(p_api_key, 'lalamove_api_key_'||v_owner_id::text);
    else
      perform vault.update_secret(v_key_id, p_api_key);
    end if;
  end if;

  if p_api_secret is not null and length(trim(p_api_secret)) > 0 then
    if v_secret_id is null then
      v_secret_id := vault.create_secret(p_api_secret, 'lalamove_api_secret_'||v_owner_id::text);
    else
      perform vault.update_secret(v_secret_id, p_api_secret);
    end if;
  end if;

  if p_is_enabled and (v_key_id is null or v_secret_id is null) then
    raise exception 'LALAMOVE_CREDENTIALS_REQUIRED';
  end if;

  insert into public.lalamove_settings (owner_id, api_key_secret_id, api_secret_secret_id, market, is_enabled)
  values (v_owner_id, v_key_id, v_secret_id, coalesce(p_market, 'PH_MNL'), coalesce(p_is_enabled, false))
  on conflict (owner_id) do update set
    api_key_secret_id = v_key_id,
    api_secret_secret_id = v_secret_id,
    market = coalesce(p_market, lalamove_settings.market),
    is_enabled = coalesce(p_is_enabled, lalamove_settings.is_enabled),
    updated_at = now();

  return jsonb_build_object(
    'market', coalesce(p_market, 'PH_MNL'),
    'is_enabled', coalesce(p_is_enabled, false),
    'has_credentials', v_key_id is not null and v_secret_id is not null
  );
end;
$$;

grant execute on function public.save_lalamove_settings(text, text, text, boolean) to authenticated;

drop function if exists public.get_lalamove_settings();
create function public.get_lalamove_settings()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_result public.lalamove_settings;
begin
  select * into v_result from public.lalamove_settings where owner_id = v_owner_id;

  if v_result.id is null then
    return jsonb_build_object('market', 'PH_MNL', 'is_enabled', false, 'has_credentials', false);
  end if;

  return jsonb_build_object(
    'market', v_result.market,
    'is_enabled', v_result.is_enabled,
    'has_credentials', v_result.api_key_secret_id is not null and v_result.api_secret_secret_id is not null,
    'updated_at', v_result.updated_at
  );
end;
$$;

grant execute on function public.get_lalamove_settings() to authenticated;

-- Decrypts a reseller's Lalamove credentials. Never exposed to authenticated
-- clients — only Edge Functions calling with the service-role key may use it.
create or replace function public.get_lalamove_credentials(p_owner_id uuid)
returns table(api_key text, api_secret text, market text)
language sql
stable
security definer
set search_path = public, vault
as $$
  select k.decrypted_secret, s.decrypted_secret, ls.market
  from public.lalamove_settings ls
  join vault.decrypted_secrets k on k.id = ls.api_key_secret_id
  join vault.decrypted_secrets s on s.id = ls.api_secret_secret_id
  where ls.owner_id = p_owner_id and ls.is_enabled = true;
$$;

revoke all on function public.get_lalamove_credentials(uuid) from public, anon, authenticated;
grant execute on function public.get_lalamove_credentials(uuid) to service_role;

-- ---------------------------------------------------------------------
-- 2. Booking status history + idempotency, and webhook audit log
-- ---------------------------------------------------------------------
create table if not exists public.lalamove_bookings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  reseller_id uuid not null references public.profiles(id) on delete cascade,
  lalamove_order_id text,
  lalamove_quotation_id text,
  status text not null default 'booking' check (status in ('booking','booked','assigning_driver','on_going','picked_up','completed','cancelled','failed')),
  quote_data jsonb,
  booking_request jsonb,
  driver_info jsonb,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one active (non-terminal-failure) booking per order — the
-- idempotency guard against double-booking the same delivery.
create unique index if not exists one_active_lalamove_booking_per_order_idx
  on public.lalamove_bookings(order_id) where status not in ('cancelled','failed');
create index if not exists idx_lalamove_bookings_reseller on public.lalamove_bookings(reseller_id);
create index if not exists idx_lalamove_bookings_lalamove_order on public.lalamove_bookings(lalamove_order_id);

alter table public.lalamove_bookings enable row level security;
drop policy if exists "lalamove_bookings_participant_read" on public.lalamove_bookings;
create policy "lalamove_bookings_participant_read" on public.lalamove_bookings for select to authenticated
using (
  reseller_id = auth.uid()
  or exists (select 1 from public.orders o where o.id = order_id and o.merchant_id = auth.uid())
  or public.is_admin()
);
grant select on public.lalamove_bookings to authenticated;

create table if not exists public.lalamove_webhook_events (
  id uuid primary key default gen_random_uuid(),
  lalamove_order_id text not null,
  event_type text,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
create index if not exists idx_lalamove_webhook_events_order on public.lalamove_webhook_events(lalamove_order_id, received_at desc);

alter table public.lalamove_webhook_events enable row level security;
drop policy if exists "lalamove_webhook_events_admin_read" on public.lalamove_webhook_events;
create policy "lalamove_webhook_events_admin_read" on public.lalamove_webhook_events for select to authenticated
using (public.is_admin());
grant select on public.lalamove_webhook_events to authenticated;

-- ---------------------------------------------------------------------
-- 3. Coordinates for booking stops (merchant pickup stays private, same
--    as business_address in merchant_address_privacy_migration.sql —
--    intentionally NOT added to that migration's explicit public column
--    grant list).
-- ---------------------------------------------------------------------
alter table public.merchant_profiles add column if not exists pickup_latitude numeric(9,6);
alter table public.merchant_profiles add column if not exists pickup_longitude numeric(9,6);
alter table public.customers add column if not exists latitude numeric(9,6);
alter table public.customers add column if not exists longitude numeric(9,6);

-- ---------------------------------------------------------------------
-- 4. Let a Lalamove quotation ride along on the existing shipping-fee
--    proposal, and auto-fire booking once the Reseller accepts it.
-- ---------------------------------------------------------------------
-- Adds a 4th parameter, which is a new overload as far as Postgres is
-- concerned — drop the old 3-arg signature so callers can't land on stale
-- behavior and PostgREST doesn't have two candidate overloads to resolve.
drop function if exists public.propose_order_shipping_fee(uuid, numeric, text);
create function public.propose_order_shipping_fee(p_order_id uuid, p_fee numeric, p_note text default null, p_lalamove_quotation_id text default null)
returns public.orders language plpgsql security definer set search_path=public as $$
declare result public.orders;
begin
  if p_fee is null or p_fee < 0 then raise exception 'VALID_SHIPPING_FEE_REQUIRED'; end if;
  update public.orders set proposed_shipping_fee=round(p_fee,2),shipping_fee_confirmation_status='pending',
    shipping_fee_merchant_note=nullif(left(trim(coalesce(p_note,'')),500),''),shipping_fee_reseller_note=null,
    lalamove_quote_id=nullif(trim(coalesce(p_lalamove_quotation_id,'')),''),
    shipping_fee_proposed_at=now(),shipping_fee_responded_at=null,updated_at=now()
  where id=p_order_id and merchant_id=auth.uid() and status='processing' and shipping_payment_method='receiver_pays_on_delivery'
  returning * into result;
  if result.id is null then raise exception 'ORDER_NOT_READY_FOR_SHIPPING_FEE'; end if;
  return result;
end $$;

grant execute on function public.propose_order_shipping_fee(uuid,numeric,text,text) to authenticated;

-- Service-role equivalent of set_order_delivery(): same effect, but reached
-- from an automated Edge Function (no merchant browser session/JWT), so it
-- gates on order state instead of merchant_id = auth.uid().
create or replace function public.complete_lalamove_dispatch(p_order_id uuid, p_lalamove_order_id text, p_pickup timestamptz default null, p_estimated timestamptz default null)
returns public.orders language plpgsql security definer set search_path=public as $$
declare result public.orders;
begin
  if char_length(trim(coalesce(p_lalamove_order_id,''))) < 1 then raise exception 'LALAMOVE_ORDER_ID_REQUIRED'; end if;
  perform set_config('app.operational_maintenance','true',true);
  update public.orders set delivery_provider='Lalamove',tracking_number=left(trim(p_lalamove_order_id),120),
    pickup_scheduled_at=coalesce(p_pickup, now()),estimated_delivery_at=p_estimated,actual_shipping_fee=proposed_shipping_fee,
    shipped_at=now(),auto_complete_at=greatest(coalesce(p_estimated,now()),now())+interval '7 days',status='shipped'
  where id=p_order_id and status='processing' and shipping_fee_confirmation_status='accepted' and proposed_shipping_fee is not null
  returning * into result;
  if result.id is null then raise exception 'ORDER_NOT_READY_FOR_LALAMOVE_DISPATCH'; end if;
  return result;
end $$;

revoke all on function public.complete_lalamove_dispatch(uuid,text,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.complete_lalamove_dispatch(uuid,text,timestamptz,timestamptz) to service_role;

-- Fires once, the moment the Reseller accepts a fee that came from a
-- Lalamove quote. Fire-and-forget: failures surface as a
-- lalamove_bookings row with status='failed', not as a blocked update here.
create or replace function public.notify_lalamove_dispatch_ready()
returns trigger language plpgsql security definer set search_path=public, vault, net as $$
declare v_secret text;
begin
  if new.shipping_fee_confirmation_status = 'accepted'
     and old.shipping_fee_confirmation_status is distinct from 'accepted'
     and new.lalamove_quote_id is not null then
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'lalamove_dispatch_secret';
    if v_secret is not null then
      perform net.http_post(
        url := 'https://ttscpfsodrcyllyvvqzb.supabase.co/functions/v1/lalamove-book',
        headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',v_secret),
        body := jsonb_build_object('order_id', new.id)
      );
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_lalamove_dispatch_ready on public.orders;
create trigger trg_notify_lalamove_dispatch_ready after update of shipping_fee_confirmation_status on public.orders
for each row execute function public.notify_lalamove_dispatch_ready();

notify pgrst, 'reload schema';

-- =====================================================================
-- MANUAL SETUP REQUIRED (not run by this migration, on purpose — same
-- convention as trigger_storage_retention_cleanup's cron_shared_secret):
--
--   select vault.create_secret('<a random value>', 'lalamove_dispatch_secret');
--
-- Then set the same value as the LALAMOVE_DISPATCH_SECRET secret on the
-- lalamove-book edge function (`supabase secrets set LALAMOVE_DISPATCH_SECRET=...`).
-- =====================================================================
