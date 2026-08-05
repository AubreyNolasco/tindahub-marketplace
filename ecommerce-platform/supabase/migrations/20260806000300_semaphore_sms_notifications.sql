-- =====================================================================
-- Semaphore SMS notifications — top-up approved, withdrawal
-- approved/rejected. Additive only: two AFTER UPDATE triggers that fire
-- alongside the EXISTING status-change flows (manual admin approval in
-- TopupRequests.jsx/WithdrawalRequests.jsx, and the PayMongo webhook's
-- auto-approval) — neither of those code paths is touched. If SMS is
-- disabled, unconfigured, or the send fails, the trigger's net.http_post
-- call still returns immediately (fire-and-forget, same convention as
-- notify_lalamove_dispatch_ready) and the status change itself always
-- succeeds regardless.
--
-- Same shared-secret convention as lalamove_dispatch_secret /
-- LALAMOVE_DISPATCH_SECRET: a random value stored once in Vault as
-- 'sms_dispatch_secret' and mirrored as the send-sms function's
-- SMS_DISPATCH_SECRET env var, so only these triggers (not the public
-- internet) can invoke send-sms. Both are set by the deploy step, not
-- this migration.
-- =====================================================================

create or replace function public.notify_topup_approved_sms()
returns trigger language plpgsql security definer set search_path = public, vault, net as $$
declare
  v_secret text;
  v_phone text;
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    select phone into v_phone from public.profiles where id = new.owner_id;
    if v_phone is null or length(trim(v_phone)) = 0 then return new; end if;

    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'sms_dispatch_secret';
    if v_secret is not null then
      perform net.http_post(
        url := 'https://ttscpfsodrcyllyvvqzb.supabase.co/functions/v1/send-sms',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
        body := jsonb_build_object(
          'to', v_phone,
          'message', 'JOM HUB: Your top-up of P' || to_char(new.amount, 'FM999,999,990.00') || ' has been approved. Check your wallet balance in the app.',
          'event_type', 'topup_approved'
        )
      );
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_topup_approved_sms on public.topup_requests;
create trigger trg_notify_topup_approved_sms
  after update of status on public.topup_requests
  for each row execute function public.notify_topup_approved_sms();

create or replace function public.notify_withdrawal_status_sms()
returns trigger language plpgsql security definer set search_path = public, vault, net as $$
declare
  v_secret text;
  v_phone text;
  v_message text;
begin
  if new.status in ('approved', 'rejected') and old.status is distinct from new.status then
    select phone into v_phone from public.profiles where id = new.owner_id;
    if v_phone is null or length(trim(v_phone)) = 0 then return new; end if;

    v_message := case
      when new.status = 'approved' then 'JOM HUB: Your withdrawal of P' || to_char(new.amount, 'FM999,999,990.00') || ' has been approved and processed.'
      else 'JOM HUB: Your withdrawal request of P' || to_char(new.amount, 'FM999,999,990.00') || ' was rejected. Check the app for details.'
    end;

    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'sms_dispatch_secret';
    if v_secret is not null then
      perform net.http_post(
        url := 'https://ttscpfsodrcyllyvvqzb.supabase.co/functions/v1/send-sms',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
        body := jsonb_build_object('to', v_phone, 'message', v_message, 'event_type', 'withdrawal_' || new.status)
      );
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_withdrawal_status_sms on public.withdrawal_requests;
create trigger trg_notify_withdrawal_status_sms
  after update of status on public.withdrawal_requests
  for each row execute function public.notify_withdrawal_status_sms();

notify pgrst, 'reload schema';
