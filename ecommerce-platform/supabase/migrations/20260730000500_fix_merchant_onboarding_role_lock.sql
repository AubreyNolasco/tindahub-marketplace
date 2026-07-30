-- protect_profile_privileges() (20260729000100_reseller_id_verification.sql)
-- blocks any non-admin change to profiles.role/account_status, with no
-- exception for the one legitimate place both actually need to change:
-- complete_account_onboarding() setting role='merchant' (from the
-- handle_new_user() default of 'reseller') the first time someone
-- completes onboarding.
--
-- Reseller signups never hit this because their role never actually
-- changes (default is already 'reseller'), so this went unnoticed until
-- now: every Merchant signup has been failing at the very first onboarding
-- step with PROTECTED_PROFILE_FIELDS, unable to proceed at all. Confirmed
-- against a live signup attempt.
--
-- Fix: allow role/account_status to change specifically during the
-- account's one-and-only onboarding_completed false -> true transition.
-- old.onboarding_completed reflects the real stored row, not anything a
-- client can spoof, and complete_account_onboarding()'s own guard
-- (ONBOARDING_ALREADY_COMPLETED) already ensures this can only ever fire
-- once per account -- so this exception can't be reused later for
-- self-promotion.

create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_onboarding_completion boolean := old.onboarding_completed = false and new.onboarding_completed = true;
begin
  if auth.uid() is not null and not public.is_admin()
     and coalesce(current_setting('app.demo_role_switch', true), '') <> 'true'
     and (
    new.id is distinct from old.id or
    (new.role is distinct from old.role and not v_onboarding_completion) or
    (new.account_status is distinct from old.account_status and not v_onboarding_completion) or
    new.created_at is distinct from old.created_at or
    new.id_verification_reviewed_at is distinct from old.id_verification_reviewed_at or
    new.id_verification_reviewed_by is distinct from old.id_verification_reviewed_by or
    new.id_verification_notes is distinct from old.id_verification_notes or
    (new.id_verification_status is distinct from old.id_verification_status and
     not (old.id_verification_status in ('missing', 'rejected') and new.id_verification_status = 'pending'))
  ) then raise exception 'PROTECTED_PROFILE_FIELDS'; end if;
  new.full_name := left(trim(new.full_name), 120);
  new.phone := left(new.phone, 30);
  return new;
end; $$;

notify pgrst, 'reload schema';
