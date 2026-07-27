-- =====================================================================
-- Storage & database growth control
-- 1. Enables pg_cron/pg_net (previously missing, so the existing hourly
--    maintenance job never actually ran) and reschedules maintenance.
-- 2. Extends run_operational_maintenance() to purge old login_history
--    and activity_audit_logs rows (pure log tables, no FK dependents).
-- 3. Adds list_storage_orphans(): a read-only, service-role-only function
--    that finds storage.objects with no matching reference in ANY known
--    table column, older than a grace period. Cross-checked against every
--    proof/permit/image/avatar/cover column in the schema. Does not touch
--    storage.objects directly (raw SQL deletes there would remove only the
--    Postgres metadata row, not the underlying file, leaving orphaned
--    billed storage) — actual deletion happens in the storage-retention-
--    cleanup edge function via the real Storage API.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------
-- Extend the existing maintenance function with safe log retention.
-- ---------------------------------------------------------------------
create or replace function public.run_operational_maintenance()
returns jsonb language plpgsql security definer set search_path=public as $$
declare hidden integer; completed integer; logins_purged integer; audit_purged integer;
begin
  update public.products p set is_active=false where is_active and exists(select 1 from public.subscriptions s where s.owner_id=p.merchant_id and (s.status<>'active' or s.expires_at<=now())); get diagnostics hidden=row_count;
  completed:=public.complete_due_deliveries();

  delete from public.login_history where logged_in_at < now() - interval '90 days'; get diagnostics logins_purged=row_count;
  delete from public.activity_audit_logs where created_at < now() - interval '365 days'; get diagnostics audit_purged=row_count;

  return jsonb_build_object('products_paused',hidden,'orders_completed',completed,'login_history_purged',logins_purged,'audit_logs_purged',audit_purged);
end $$;

revoke all on function public.run_operational_maintenance() from public,anon;
grant execute on function public.run_operational_maintenance() to authenticated;

-- Reschedule the hourly job now that pg_cron actually exists.
do $$
begin
  perform cron.unschedule('jom-hub-operational-maintenance');
exception when others then null;
end $$;
select cron.schedule('jom-hub-operational-maintenance','15 * * * *','select public.run_operational_maintenance();');

-- ---------------------------------------------------------------------
-- Orphaned storage object detection (read-only; service_role only).
-- ---------------------------------------------------------------------
create or replace function public.list_storage_orphans(p_grace_period interval default '7 days')
returns table(bucket_id text, object_name text)
language sql
security definer
set search_path = public, storage
as $$
  with referenced as (
    select 'payment-proofs'::text as bucket, proof_url as path from public.payments where proof_url is not null
    union all select 'payment-proofs', proof_url from public.subscription_requests where proof_url is not null
    union all select 'payment-proofs', proof_url from public.topup_requests where proof_url is not null
    union all select 'withdrawal-proofs', transfer_proof_url from public.withdrawal_requests where transfer_proof_url is not null
    union all select 'delivery-proofs', dispatch_proof_url from public.orders where dispatch_proof_url is not null
    union all select 'order-case-evidence', evidence_url from public.order_cases where evidence_url is not null
    union all select 'business-permits', business_permit_url from public.merchant_profiles where business_permit_url is not null
    union all select 'product-images', regexp_replace(img,'^.*/storage/v1/object/public/product-images/','') from public.products, unnest(coalesce(images,'{}'::text[])) as img
    union all select 'reseller-storefronts', regexp_replace(avatar_url,'^.*/storage/v1/object/public/reseller-storefronts/','') from public.profiles where avatar_url like '%reseller-storefronts%'
    union all select 'reseller-storefronts', regexp_replace(cover_url,'^.*/storage/v1/object/public/reseller-storefronts/','') from public.profiles where cover_url like '%reseller-storefronts%'
  )
  select o.bucket_id, o.name
  from storage.objects o
  where o.created_at < now() - p_grace_period
    and not exists (select 1 from referenced r where r.bucket = o.bucket_id and r.path = o.name)
$$;

revoke all on function public.list_storage_orphans(interval) from public, anon, authenticated;
grant execute on function public.list_storage_orphans(interval) to service_role;

-- ---------------------------------------------------------------------
-- Weekly scheduled call to the storage-retention-cleanup edge function,
-- which performs the actual deletion via the real Storage API (so both
-- the file bytes and the metadata row are removed together). The shared
-- secret is created separately via `select vault.create_secret(...)` run
-- directly against the database (never committed to a migration file, so
-- it never lands in git) — this migration only reads it back by name.
-- ---------------------------------------------------------------------
create or replace function public.trigger_storage_retention_cleanup()
returns void
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_shared_secret';
  if v_secret is null then return; end if;
  perform net.http_post(
    url := 'https://ttscpfsodrcyllyvvqzb.supabase.co/functions/v1/storage-retention-cleanup',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',v_secret),
    body := '{}'::jsonb
  );
end $$;

revoke all on function public.trigger_storage_retention_cleanup() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('jom-hub-storage-retention-cleanup');
exception when others then null;
end $$;
select cron.schedule('jom-hub-storage-retention-cleanup','30 3 * * 0','select public.trigger_storage_retention_cleanup();');

notify pgrst, 'reload schema';
