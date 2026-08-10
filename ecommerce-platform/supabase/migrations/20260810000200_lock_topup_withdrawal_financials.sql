-- =====================================================================
-- orders already has trg_lock_order_financials (lock_order_financials(),
-- see 20260807000600_revert_redundant_order_status_lock.sql) blocking
-- any non-admin write from changing total/subtotal/fees/reseller_id/
-- merchant_id, specifically so a staff account scoped to a narrow
-- admin_permission can't tamper with the money fields while doing the
-- job that permission is meant to allow (e.g. approving/reviewing).
--
-- topup_requests and withdrawal_requests never got the same lock.
-- 20260807000800_staff_writer_attribution.sql's own header comment
-- flags "topup_requests (staff_topups_manage) -> reviewed_by: REAL GAP"
-- and fixes the reviewed_by attribution, but the surrounding `with
-- check` clauses it left in place only ever pinned reviewed_by =
-- auth.uid() -- they never restricted amount, owner_id, method, or (for
-- withdrawals) the destination bank_name/bank_account_name/
-- bank_account_number. A staff account holding only the 'topups' or
-- 'withdrawals' admin_permission -- not full admin -- can currently
-- raise a pending topup's amount before approving it (minting wallet
-- balance for no real payment received), or repoint a pending
-- withdrawal's bank account to a different account before approving it
-- (redirecting a real payout). Neither is reachable from the current
-- UI, which never sends these fields in its update payload, but both
-- are reachable by anyone with API access and a scoped staff session --
-- exactly the class of gap 20260807000400's referral_appointments fix
-- and this same migration's own reviewed_by fix were written to close,
-- just missed on these two tables.
--
-- Fix: mirror lock_order_financials()'s shape -- block the request's
-- own identity/amount/destination fields from changing under any
-- non-admin write, full admins remain exempt (they already can amend
-- order financials the same way when resolving disputes).
-- =====================================================================

create or replace function public.lock_topup_request_financials()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.amount is distinct from old.amount or new.owner_id is distinct from old.owner_id or
       new.method is distinct from old.method or new.reference_number is distinct from old.reference_number
    then raise exception 'TOPUP_REQUEST_FINANCIALS_LOCKED'; end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_lock_topup_request_financials on public.topup_requests;
create trigger trg_lock_topup_request_financials before update on public.topup_requests
  for each row execute function public.lock_topup_request_financials();

create or replace function public.lock_withdrawal_request_financials()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.amount is distinct from old.amount or new.owner_id is distinct from old.owner_id or
       new.bank_name is distinct from old.bank_name or new.bank_account_name is distinct from old.bank_account_name or
       new.bank_account_number is distinct from old.bank_account_number
    then raise exception 'WITHDRAWAL_REQUEST_FINANCIALS_LOCKED'; end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_lock_withdrawal_request_financials on public.withdrawal_requests;
create trigger trg_lock_withdrawal_request_financials before update on public.withdrawal_requests
  for each row execute function public.lock_withdrawal_request_financials();

notify pgrst, 'reload schema';
