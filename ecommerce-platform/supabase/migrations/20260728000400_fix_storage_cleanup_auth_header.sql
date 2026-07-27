-- The Supabase Edge Functions gateway requires a valid Authorization
-- bearer token before a request even reaches function code (separate from
-- any in-function auth). The first attempt omitted it, so calls were
-- rejected with 401 before the x-cron-secret check ever ran. Adds the
-- (public, non-secret) anon key for gateway auth; the actual authorization
-- gate remains the x-cron-secret header checked inside the function.
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
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret',v_secret,
      'Authorization','Bearer sb_publishable_kmksvXci6j4ziJdwilESUg_HvE2hyqv'
    ),
    body := '{}'::jsonb
  );
end $$;

revoke all on function public.trigger_storage_retention_cleanup() from public, anon, authenticated;

notify pgrst, 'reload schema';
