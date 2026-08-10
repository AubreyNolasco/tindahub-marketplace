-- =====================================================================
-- Same class of gap 20260808001000_id_verification_notification.sql
-- closed for resellers (review_reseller_id_verification() notifies on
-- both approve and reject) was never closed for merchants. Admin/
-- Merchants.jsx reviews both the business permit (reviewPermit /
-- confirmPermitApproval) and the merchant account itself (updateStatus)
-- with plain client-side `.update()` calls on merchant_profiles -- no
-- RPC, no trigger, so a merchant whose permit or account gets rejected
-- currently has no way to find out short of re-visiting the page and
-- noticing the status changed. Implemented as AFTER UPDATE triggers
-- (rather than converting the admin UI to RPCs) so this closes the gap
-- regardless of which admin code path performs the update.
-- =====================================================================

create or replace function public.notify_business_permit_reviewed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.business_permit_status is distinct from old.business_permit_status
     and new.business_permit_status in ('approved', 'rejected') then
    perform public.create_notification(
      new.id, 'business_permit',
      case when new.business_permit_status = 'approved' then 'Business permit approved' else 'Business permit needs another look' end,
      case when new.business_permit_status = 'approved'
        then coalesce('Approved' || (case when new.business_permit_expires_at is not null then ' until ' || to_char(new.business_permit_expires_at, 'FMMonth DD, YYYY') else '' end) || '.', 'Your business permit was approved.')
        else coalesce(nullif(trim(new.business_permit_notes), ''), 'Your submitted business permit could not be verified. Please resubmit.') end,
      '/merchant-permit',
      jsonb_build_object('status', new.business_permit_status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_business_permit_reviewed on public.merchant_profiles;
create trigger trg_notify_business_permit_reviewed
  after update of business_permit_status on public.merchant_profiles
  for each row execute function public.notify_business_permit_reviewed();

create or replace function public.notify_merchant_account_reviewed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected', 'suspended') then
    perform public.create_notification(
      new.id, 'merchant_account',
      case new.status
        when 'approved' then 'Merchant account approved'
        when 'suspended' then 'Merchant account suspended'
        else 'Merchant account application rejected'
      end,
      case new.status
        when 'approved' then 'Your merchant account is approved. You can now list products and receive orders.'
        when 'suspended' then 'Your merchant account has been suspended. Contact support for details.'
        else 'Your merchant account application was not approved. Contact support for details.'
      end,
      '/merchant',
      jsonb_build_object('status', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_merchant_account_reviewed on public.merchant_profiles;
create trigger trg_notify_merchant_account_reviewed
  after update of status on public.merchant_profiles
  for each row execute function public.notify_merchant_account_reviewed();

notify pgrst, 'reload schema';
