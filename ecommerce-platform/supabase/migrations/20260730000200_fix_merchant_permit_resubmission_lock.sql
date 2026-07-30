-- Fix a self-inflicted lock in the previous migration
-- (20260730000100_merchant_operate_followup.sql): protect_merchant_privileges()
-- was extended to guard business_permit_reviewed_at/reviewed_by/notes so a
-- merchant couldn't self-approve their own permit now that the RLS gate no
-- longer requires an already-approved account. But BusinessPermit.jsx's
-- resubmit flow ALSO clears those same three fields (and sometimes
-- merchant_profiles.status) in the same UPDATE call, which the previous,
-- unconditional guard rejected outright -- so a merchant who was ever
-- reviewed (rejected, or previously approved and later demoted) could
-- never resubmit a new permit.
--
-- Fix: only allow reviewed_at/reviewed_by/notes to be cleared (to
-- null/null/'') specifically when business_permit_status is transitioning
-- missing/rejected -> pending in the same update (the legitimate
-- resubmission case), and allow merchant_profiles.status to self-reset
-- approved/rejected -> pending independently (mirrors how
-- protect_profile_privileges() already lets a Reseller self-reset
-- id_verification_status missing/rejected -> pending). Every other change
-- to these fields by a non-admin is still rejected.

create or replace function public.protect_merchant_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_permit_resubmission boolean := old.business_permit_status in ('missing', 'rejected') and new.business_permit_status = 'pending';
  v_status_reset boolean := old.status in ('approved', 'rejected') and new.status = 'pending';
begin
  if auth.uid() is not null and not public.is_admin()
     and coalesce(current_setting('app.demo_role_switch', true), '') <> 'true'
     and (
    new.id is distinct from old.id or
    (new.status is distinct from old.status and not v_status_reset) or
    new.subscription_active is distinct from old.subscription_active or
    new.subscription_expires_at is distinct from old.subscription_expires_at or
    new.trial_ends_at is distinct from old.trial_ends_at or new.created_at is distinct from old.created_at or
    new.business_permit_expires_at is distinct from old.business_permit_expires_at or
    new.operate_grace_until is distinct from old.operate_grace_until or
    (new.business_permit_status is distinct from old.business_permit_status and not v_permit_resubmission) or
    (not v_permit_resubmission and (
      new.business_permit_reviewed_at is distinct from old.business_permit_reviewed_at or
      new.business_permit_reviewed_by is distinct from old.business_permit_reviewed_by or
      new.business_permit_notes is distinct from old.business_permit_notes
    )) or
    (v_permit_resubmission and (
      new.business_permit_reviewed_at is not null or
      new.business_permit_reviewed_by is not null or
      coalesce(new.business_permit_notes, '') <> ''
    ))
  ) then raise exception 'PROTECTED_MERCHANT_FIELDS'; end if;
  new.business_name := left(trim(new.business_name), 160);
  new.business_description := left(new.business_description, 2000);
  new.business_address := left(new.business_address, 500);
  return new;
end; $$;

notify pgrst, 'reload schema';
