-- Production security hardening:
-- 1. Disable privileged test identities and revoke their active sessions.
-- 2. Require the approved active device for authenticated data mutations.
-- 3. Require a verified account and one active appointment per registration.
-- 4. Remove unnecessary PUBLIC execution of maintenance functions.

do $$
declare
  v_test_ids uuid[];
begin
  select coalesce(array_agg(id), array[]::uuid[]) into v_test_ids
  from auth.users
  where lower(email) in ('reseller@gmail.com','merchant@gmail.com');

  update auth.users
  set banned_until='infinity'::timestamptz,
      updated_at=now()
  where id=any(v_test_ids);

  delete from auth.sessions where user_id=any(v_test_ids);

  update public.profiles
  set account_status='rejected',
      updated_at=now()
  where id=any(v_test_ids);

  update public.merchant_profiles
  set status='suspended',
      subscription_active=false
  where id=any(v_test_ids);

  update public.subscriptions
  set status='cancelled',
      updated_at=now()
  where owner_id=any(v_test_ids);

  update public.wallets
  set balance=0,
      updated_at=now()
  where owner_id=any(v_test_ids);
end
$$;

create or replace function public.require_active_device_for_mutation()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_device_id text;
begin
  -- Internal database jobs and trusted auth triggers do not have a user JWT.
  if auth.uid() is null then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;

  v_device_id := nullif(
    trim(coalesce(
      (nullif(current_setting('request.headers',true),'')::jsonb ->> 'x-jomhub-device-id'),
      ''
    )),
    ''
  );

  if v_device_id is null or not exists (
    select 1
    from public.user_device_access d
    where d.user_id=auth.uid()
      and d.active_device_id=v_device_id
  ) then
    raise exception 'DEVICE_APPROVAL_REQUIRED';
  end if;

  if tg_op='DELETE' then return old; end if;
  return new;
end
$$;

revoke all on function public.require_active_device_for_mutation() from public,anon,authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'profiles','merchant_profiles','products','customers','orders','payments',
    'wallets','wallet_transactions','topup_requests','withdrawal_requests',
    'subscriptions','subscription_requests','customer_payment_records',
    'order_cases','product_reviews','merchant_campaigns','staff_access',
    'staff_invitations','account_invitations','subscription_plans',
    'system_policies','site_settings','registration_unavailable_slots'
  ]
  loop
    if to_regclass('public.' || v_table) is not null then
      execute format('drop trigger if exists require_active_device_mutation on public.%I',v_table);
      execute format(
        'create trigger require_active_device_mutation before insert or update or delete on public.%I for each row execute function public.require_active_device_for_mutation()',
        v_table
      );
    end if;
  end loop;
end
$$;

alter table public.registration_appointments
add column if not exists submitted_by uuid references auth.users(id);

update public.registration_appointments
set submitted_by=null
where submitted_by is not null
  and not exists(select 1 from auth.users u where u.id=submitted_by);

drop policy if exists "public_create_registration_appointment" on public.registration_appointments;
create policy "verified_user_create_registration_appointment"
on public.registration_appointments for insert to authenticated
with check (
  submitted_by=auth.uid()
  and status='pending'
);

revoke insert on public.registration_appointments from anon;
grant insert on public.registration_appointments to authenticated;

create unique index if not exists registration_one_active_booking_per_user
on public.registration_appointments(submitted_by)
where submitted_by is not null and status in ('pending','contacted','confirmed');

create or replace function public.guard_registration_schedule()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op='INSERT' then
    if auth.uid() is null then raise exception 'VERIFIED_EMAIL_REQUIRED'; end if;
    new.submitted_by := auth.uid();
    new.email := lower((select email from auth.users where id=auth.uid()));
    new.status := 'pending';
  end if;

  if new.preferred_date > (timezone('Asia/Manila',now())::date + 90) then
    raise exception 'REGISTRATION_DATE_TOO_FAR';
  end if;

  if to_char(new.preferred_time,'HH24:MI') not in ('09:00','10:00','11:00','13:00','14:00','15:00','16:00') then
    raise exception 'REGISTRATION_TIME_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(new.preferred_date::text || '|' || new.preferred_time::text)
  );

  if (new.preferred_date + new.preferred_time) <= timezone('Asia/Manila',now()) then
    raise exception 'REGISTRATION_TIME_PASSED';
  end if;

  if exists (
    select 1 from public.registration_unavailable_slots s
    where s.unavailable_date=new.preferred_date
      and (s.unavailable_time is null or s.unavailable_time=new.preferred_time)
  ) then raise exception 'REGISTRATION_SLOT_UNAVAILABLE'; end if;

  if exists (
    select 1 from public.registration_appointments a
    where a.id<>new.id
      and a.preferred_date=new.preferred_date
      and a.preferred_time=new.preferred_time
      and a.status<>'cancelled'
  ) then raise exception 'REGISTRATION_SLOT_RESERVED'; end if;

  return new;
end
$$;

revoke all on function public.run_operational_maintenance() from public,anon;
grant execute on function public.run_operational_maintenance() to authenticated;

notify pgrst,'reload schema';
