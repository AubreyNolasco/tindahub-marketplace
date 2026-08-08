-- AdminNotifications.jsx already covers subscriptions, top-ups,
-- onboarding schedules, support messages, order cases, and
-- withdrawals -- but not a merchant submitting/resubmitting their
-- business permit for review (BusinessPermit.jsx does a plain client-
-- side `update merchant_profiles set business_permit_status='pending'`,
-- no RPC to hook into). merchant_profiles has no submission timestamp
-- to sort a notification by -- only `created_at` (registration time),
-- which would misdate a *resubmission* after rejection, potentially
-- burying it below genuinely older items in the merged, time-sorted
-- notification list.
alter table public.merchant_profiles
  add column if not exists business_permit_submitted_at timestamptz;

-- One-time backfill: any merchant already sitting in 'pending' when
-- this migration runs gets submitted_at = created_at as the closest
-- available approximation, so they don't just vanish from the new
-- producer below at 'null' -- everything from this point forward gets
-- the real, accurate timestamp via the trigger.
update public.merchant_profiles
set business_permit_submitted_at = created_at
where business_permit_status = 'pending' and business_permit_submitted_at is null;

create or replace function public.stamp_business_permit_submission()
returns trigger
language plpgsql
as $$
begin
  if new.business_permit_status = 'pending' and (old.business_permit_status is distinct from 'pending') then
    new.business_permit_submitted_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stamp_business_permit_submission on public.merchant_profiles;
create trigger trg_stamp_business_permit_submission
  before update of business_permit_status on public.merchant_profiles
  for each row execute function public.stamp_business_permit_submission();
