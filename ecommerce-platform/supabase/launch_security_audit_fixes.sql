-- Launch security audit fixes (2026-07-21). Safe and idempotent.

-- Never permit API roles to create arbitrary objects in the public schema.
revoke create on schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;

-- SECURITY DEFINER campaign writers must still prove the caller is Admin.
create or replace function public.guard_campaign_privileged_writes()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if new.created_by is null or not exists(select 1 from public.profiles where id=new.created_by and role='admin') then
    raise exception 'VALID_ADMIN_OWNER_REQUIRED';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_campaign_privileged_writes on public.campaigns;
create trigger trg_guard_campaign_privileged_writes before insert on public.campaigns
for each row execute function public.guard_campaign_privileged_writes();

-- Normalize and throttle public appointment submissions. This is defense in
-- depth; production should also enable CAPTCHA/WAF rate limiting.
alter table public.registration_appointments add column if not exists submission_fingerprint text;
create or replace function public.guard_public_appointment_submission()
returns trigger language plpgsql security definer set search_path=public as $$
declare headers jsonb; caller_ip text;
begin
  new.full_name:=left(trim(new.full_name),120);
  new.email:=lower(left(trim(new.email),254));
  new.phone:=left(regexp_replace(new.phone,'[^0-9+]','','g'),30);
  new.notes:=left(trim(coalesce(new.notes,'')),1000);
  new.status:='pending'; new.updated_at:=now();
  if exists(select 1 from public.registration_appointments where email=new.email and created_at>now()-interval '24 hours') then
    raise exception 'APPOINTMENT_ALREADY_SUBMITTED';
  end if;
  begin headers:=nullif(current_setting('request.headers',true),'')::jsonb; caller_ip:=coalesce(headers->>'cf-connecting-ip',split_part(headers->>'x-forwarded-for',',',1)); exception when others then caller_ip:=null; end;
  if caller_ip is not null and (select count(*) from public.registration_appointments where created_at>now()-interval '1 hour' and submission_fingerprint=md5(caller_ip))>=5 then
    raise exception 'TOO_MANY_APPOINTMENT_REQUESTS';
  end if;
  if caller_ip is not null then new.submission_fingerprint:=md5(caller_ip); end if;
  return new;
end $$;
drop trigger if exists trg_guard_public_appointment_submission on public.registration_appointments;
create trigger trg_guard_public_appointment_submission before insert on public.registration_appointments
for each row execute function public.guard_public_appointment_submission();

-- Public callers never need direct access to maintenance or trigger routines.
revoke execute on function public.ensure_recurring_campaigns() from public, anon;
revoke execute on function public.purge_old_login_history() from public, anon;
revoke execute on function public.publish_system_policy(uuid) from public, anon;
revoke execute on function public.place_order(uuid,text,jsonb,numeric) from public, anon;
revoke execute on function public.request_withdrawal(numeric,text,text,text) from public, anon;

-- Financial snapshot columns must remain immutable after checkout, including
-- the newer sustainable-revenue fields.
create or replace function public.lock_order_financials()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and not public.is_admin() and (
    new.total is distinct from old.total or new.subtotal is distinct from old.subtotal or
    new.shipping_fee is distinct from old.shipping_fee or new.reseller_operation_fee is distinct from old.reseller_operation_fee or
    new.platform_fee is distinct from old.platform_fee or new.merchant_gross_amount is distinct from old.merchant_gross_amount or
    new.merchant_net_amount is distinct from old.merchant_net_amount or new.fee_rate_snapshot is distinct from old.fee_rate_snapshot or
    new.reseller_id is distinct from old.reseller_id or new.merchant_id is distinct from old.merchant_id
  ) then raise exception 'ORDER_FINANCIALS_LOCKED'; end if;
  return new;
end $$;
drop trigger if exists trg_lock_order_financials on public.orders;
create trigger trg_lock_order_financials before update on public.orders for each row execute function public.lock_order_financials();
