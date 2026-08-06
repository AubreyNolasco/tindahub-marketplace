-- Phase 7 + 11 of TASK6.md: a real pg_cron-driven scheduler, following the
-- exact guarded-schedule pattern already established by
-- 20260722000700_automatic_maintenance_schedule.sql's
-- run_operational_maintenance() (same security-definer/jsonb-summary
-- shape, same "only schedule if pg_cron is actually available" guard).
--
-- Closes a real gap flagged in Phase 1: ensure_recurring_campaigns() was
-- previously only ever invoked lazily from Admin/Campaigns.jsx's page
-- load -- if no admin opened that page, next month's Payday/Double Day
-- campaigns silently never got created. Now it runs on its own schedule
-- regardless of whether anyone opens the admin page.
--
-- Also gives the 'active'/'expired'/'paused' states in
-- campaign_submission_status (added in Phase 2 but never populated by
-- anything until now) real meaning:
--   approved  -> active   when the campaign's window opens
--   any open  -> expired  once the campaign's end date has passed
--   active    -> paused   when an admin disables the campaign (the
--                          existing Enable/Disable toggle in
--                          Admin/Campaigns.jsx now does double duty)
--   paused    -> active   if the admin re-enables it while still in window
create or replace function public.run_campaign_scheduler()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activated integer;
  v_expired integer;
  v_paused integer;
  v_resumed integer;
begin
  perform public.ensure_recurring_campaigns();

  update public.campaign_products cp set status = 'active'
  from public.campaigns c
  where cp.campaign_id = c.id and cp.status = 'approved' and c.is_active and now() between c.starts_at and c.ends_at;
  get diagnostics v_activated = row_count;

  update public.campaign_products cp set status = 'expired'
  from public.campaigns c
  where cp.campaign_id = c.id and cp.status in ('draft', 'pending', 'approved', 'active', 'paused') and c.ends_at <= now();
  get diagnostics v_expired = row_count;

  update public.campaign_products cp set status = 'paused'
  from public.campaigns c
  where cp.campaign_id = c.id and cp.status = 'active' and not c.is_active;
  get diagnostics v_paused = row_count;

  update public.campaign_products cp set status = 'active'
  from public.campaigns c
  where cp.campaign_id = c.id and cp.status = 'paused' and c.is_active and now() between c.starts_at and c.ends_at;
  get diagnostics v_resumed = row_count;

  return jsonb_build_object('activated', v_activated, 'expired', v_expired, 'paused', v_paused, 'resumed', v_resumed);
end;
$$;

do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    execute 'select cron.unschedule(jobid) from cron.job where jobname=''jom-hub-campaign-scheduler''';
    execute $schedule$select cron.schedule('jom-hub-campaign-scheduler','20 * * * *','select public.run_campaign_scheduler();')$schedule$;
  end if;
end $$;

notify pgrst, 'reload schema';
