-- Security audit sweep (requested by the owner after the vouchers RLS
-- gap): checked every table with a direct write grant to `authenticated`
-- against its RLS policies for the same failure shape -- an ownership
-- check that never validates role/status/transition. Found two more,
-- both pre-existing (not introduced by the Phase 6 promotion work),
-- fixed here.
--
-- ---------------------------------------------------------------------
-- 1. referral_appointments -- HIGH: a merchant could bypass
-- confirm_referral_appointment()/complete_referral_appointment()
-- entirely via a direct client update. `referral_merchant_update` had
-- no WITH CHECK at all, and the table still carried a direct
-- insert/update/delete grant to `authenticated` from when the table was
-- first created (clinic_referral_system.sql) -- even though every
-- legitimate write already goes through the four RPCs in that same
-- file, none of which need the grant (SECURITY DEFINER runs as the
-- function owner, not the caller). Net effect: a merchant could set
-- status='completed' directly, skipping complete_referral_appointment()
-- and its wallet debit/credit -- marking a referral fulfilled without
-- ever paying the reseller the referral_fee they're owed. Grepped the
-- whole frontend first: zero direct `.from('referral_appointments')`
-- calls exist anywhere, so revoking the grant breaks nothing.
-- ---------------------------------------------------------------------
revoke insert, update, delete on public.referral_appointments from authenticated;

-- ---------------------------------------------------------------------
-- 2. clinic_services -- MEDIUM: the exact bug already found and fixed
-- for `products` in 20260730000800_close_suspended_merchant_product_gap.sql
-- ("suspended now also blocks product insert/update outright"), just
-- never applied to this parallel table. A suspended/rejected merchant
-- could still create new clinic services or keep editing existing ones,
-- and sync_suspended_merchant_products() only ever deactivated
-- `products`, never `clinic_services` -- so a suspended merchant's
-- referral services stayed publicly bookable indefinitely. Fixed the
-- same way, in both places: harden the write policies, and extend the
-- existing suspension trigger to also deactivate clinic_services (kept
-- as one trigger reacting to one event, per the reuse-first policy,
-- rather than a second near-duplicate trigger on the same table).
-- ---------------------------------------------------------------------
drop policy if exists "clinic_services_merchant_insert" on public.clinic_services;
create policy "clinic_services_merchant_insert" on public.clinic_services for insert
  with check (merchant_id = auth.uid() and public.current_user_role() = 'merchant'
    and (public.is_approved_account() or public.merchant_has_operate_grace(auth.uid()))
    and not exists (select 1 from public.merchant_profiles where id = auth.uid() and status = 'suspended'));

drop policy if exists "clinic_services_merchant_update" on public.clinic_services;
create policy "clinic_services_merchant_update" on public.clinic_services for update
  using ((merchant_id = auth.uid() and public.current_user_role() = 'merchant'
    and (public.is_approved_account() or public.merchant_has_operate_grace(auth.uid()))
    and not exists (select 1 from public.merchant_profiles where id = auth.uid() and status = 'suspended')) or public.is_admin())
  with check ((merchant_id = auth.uid() and public.current_user_role() = 'merchant'
    and (public.is_approved_account() or public.merchant_has_operate_grace(auth.uid()))
    and not exists (select 1 from public.merchant_profiles where id = auth.uid() and status = 'suspended')) or public.is_admin());

create or replace function public.sync_suspended_merchant_products()
returns trigger language plpgsql security definer set search_path=public as $$ begin
  if new.status in('suspended','rejected') and old.status is distinct from new.status then
    update public.products set is_active=false where merchant_id=new.id;
    update public.clinic_services set is_active=false where merchant_id=new.id;
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';
