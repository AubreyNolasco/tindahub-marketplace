-- Phase 13 of TASK6.md: Admin Center upgrades. `campaigns` today only has
-- `is_active` (used as the Enable/Disable toggle, and doing double duty
-- as the scheduler's "paused" signal for campaign_products per
-- 20260806001600_campaign_scheduler.sql) -- there's no way to hide an old,
-- long-ended campaign from the admin's default view without deleting it.
-- Additive column, existing rows default to not-archived, no behavior
-- change for anything that already reads/writes `campaigns`.
alter table public.campaigns add column if not exists archived boolean not null default false;
create index if not exists idx_campaigns_archived on public.campaigns(archived);
notify pgrst, 'reload schema';
