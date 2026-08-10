-- notify_topup_approved_sms() (20260806000300) only fired
-- 'if new.status = ''approved'''; withdrawal_requests got both
-- approved/rejected SMS via notify_withdrawal_status_sms() in the same
-- migration, but a rejected top-up never sent one. Extends the topup
-- trigger to match, same message/event_type shape as the withdrawal
-- rejection SMS.

create or replace function public.notify_topup_status_sms()
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
      when new.status = 'approved' then 'JOM HUB: Your top-up of P' || to_char(new.amount, 'FM999,999,990.00') || ' has been approved. Check your wallet balance in the app.'
      else 'JOM HUB: Your top-up request of P' || to_char(new.amount, 'FM999,999,990.00') || ' was rejected. Check the app for details.'
    end;

    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'sms_dispatch_secret';
    if v_secret is not null then
      perform net.http_post(
        url := 'https://ttscpfsodrcyllyvvqzb.supabase.co/functions/v1/send-sms',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
        body := jsonb_build_object('to', v_phone, 'message', v_message, 'event_type', 'topup_' || new.status)
      );
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_topup_approved_sms on public.topup_requests;
drop trigger if exists trg_notify_topup_status_sms on public.topup_requests;
create trigger trg_notify_topup_status_sms
  after update of status on public.topup_requests
  for each row execute function public.notify_topup_status_sms();

-- Superseded by notify_topup_status_sms(); dropped rather than left
-- dangling since the trigger above already replaces its only caller.
drop function if exists public.notify_topup_approved_sms();

notify pgrst, 'reload schema';
