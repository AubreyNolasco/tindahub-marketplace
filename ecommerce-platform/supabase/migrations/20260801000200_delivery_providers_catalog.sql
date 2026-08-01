-- =====================================================================
-- Delivery Provider Engine — Phase 0
--
-- Adds the catalog table only: what delivery providers exist, and
-- whether each is currently allowed to run. Nothing reads this table
-- yet (Lalamove dispatch is untouched, still fully wired through
-- lalamove_settings / lalamove_bookings). Purely additive — no
-- behavior change.
--
-- Phase 1 wraps the existing Lalamove client in an adapter matching
-- this catalog's shape. Later phases (see delivery-engine-architecture
-- doc) formalize ownership and swap the free-text orders.delivery_provider
-- column for a real reference.
-- =====================================================================

create table if not exists public.delivery_providers (
  code text primary key,
  name text not null,
  supports_tracking boolean not null default true,
  supports_cancellation boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.delivery_providers enable row level security;

drop policy if exists "delivery_providers_public_read" on public.delivery_providers;
create policy "delivery_providers_public_read" on public.delivery_providers
  for select to authenticated using (true);

drop policy if exists "delivery_providers_admin_write" on public.delivery_providers;
create policy "delivery_providers_admin_write" on public.delivery_providers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.delivery_providers to authenticated;

insert into public.delivery_providers (code, name, is_active) values
  ('lalamove',    'Lalamove',    true),
  ('manual',      'Manual / Standard Delivery', true),
  ('grabexpress', 'GrabExpress', false),
  ('borzo',       'Borzo',       false),
  ('ninjavan',    'Ninja Van',   false),
  ('jnt',         'J&T Express', false)
on conflict (code) do nothing;

notify pgrst, 'reload schema';
