-- TASKBLACKBOX.md Task 2: staff_*_manage policies (permissioned staff, not
-- full admins) check has_admin_permission() but never force the "who did
-- this" column to the caller. Not a privilege escalation -- a staff member
-- with the permission already has full write access to the resource -- but
-- today they *could* insert/update a row and set its authorship/review
-- column to any arbitrary profile id instead of their own, misattributing
-- it in an audit trail. Checked every table listed in TASKBLACKBOX.md:
--
--   campaigns (staff_campaigns_manage)          -> created_by:  REAL GAP, fixed below (insert-only, see note)
--   topup_requests (staff_topups_manage)        -> reviewed_by: REAL GAP, fixed below
--   withdrawal_requests (staff_withdrawals_manage) -> reviewed_by: REAL GAP, fixed below
--   site_settings (staff_homepage_manage)       -> no created_by/updated_by column exists at all -- nothing to force
--   registration_appointments (staff_registrations_manage) -> only submitted_by (set by the person who
--                                                   submits the appointment request, not by staff reviewing it) -- no
--                                                   staff-attribution column exists -- nothing to force
--   subscription_requests (staff_subscription_requests_manage) -> reviewed_by: REAL GAP, fixed below
--   payments (staff_payments_manage)            -> verified_by: REAL GAP, fixed below
--
-- Confirmed the "real gap" cases are real (not already enforced elsewhere) by
-- grepping every frontend write path: Admin/TopupRequests.jsx,
-- Admin/WithdrawalRequests.jsx, Admin/Subscriptions.jsx (reject branch --
-- approve goes through activate_merchant_application(), a security-definer
-- RPC unaffected by RLS), Merchant/Orders.jsx (payments.verified_by), and
-- Admin/Campaigns.jsx all do a raw supabase.from(table).update(...)/.insert(...)
-- with the attribution column set client-side to the current user's own id
-- today -- correct in practice, but not actually enforced, so a modified
-- request could set it to anyone.
--
-- Also extends the fix to each table's equivalent *_admin_update policy
-- (topup_admin_update, withdrawal_admin_update, subscription_request_admin_update,
-- payments_admin_update) -- found while reading these tables' full policy list,
-- same shape of gap, same column, same frontend code path, so left unfixed it
-- would just mean "full admin" bypasses the same check "staff" no longer can.
--
-- campaigns.created_by is different in kind from the reviewed_by/verified_by
-- columns above: it's row *authorship* (who created it), not "who most
-- recently acted on it" -- Admin/Campaigns.jsx's toggle-active and
-- toggle-archived actions are plain UPDATEs that never re-send created_by,
-- so forcing created_by = auth.uid() on every UPDATE (the way the existing
-- campaigns_admin_manage policy already does, harmlessly today only because
-- there is currently exactly one admin account) would wrongly block one
-- staff member from toggling a campaign a *different* staff member created.
-- Split into insert/update/delete policies instead of one ALL policy so the
-- authorship check only applies at creation, matching what campaigns_admin_manage
-- was actually trying to guarantee without its latent same-account assumption.

drop policy if exists "staff_campaigns_manage" on public.campaigns;

create policy "staff_campaigns_manage_select" on public.campaigns for select
  using (has_admin_permission('campaigns'));

create policy "staff_campaigns_manage_insert" on public.campaigns for insert
  with check (has_admin_permission('campaigns') and created_by = auth.uid());

create policy "staff_campaigns_manage_update" on public.campaigns for update
  using (has_admin_permission('campaigns'))
  with check (has_admin_permission('campaigns'));

create policy "staff_campaigns_manage_delete" on public.campaigns for delete
  using (has_admin_permission('campaigns'));

drop policy if exists "staff_topups_manage" on public.topup_requests;
create policy "staff_topups_manage" on public.topup_requests for all
  using (has_admin_permission('overview') or has_admin_permission('topups') or has_admin_permission('reports'))
  with check (has_admin_permission('topups') and reviewed_by = auth.uid());

drop policy if exists "topup_admin_update" on public.topup_requests;
create policy "topup_admin_update" on public.topup_requests for update
  using (is_admin())
  with check (reviewed_by = auth.uid());

drop policy if exists "staff_withdrawals_manage" on public.withdrawal_requests;
create policy "staff_withdrawals_manage" on public.withdrawal_requests for all
  using (has_admin_permission('overview') or has_admin_permission('withdrawals') or has_admin_permission('reports'))
  with check (has_admin_permission('withdrawals') and reviewed_by = auth.uid());

drop policy if exists "withdrawal_admin_update" on public.withdrawal_requests;
create policy "withdrawal_admin_update" on public.withdrawal_requests for update
  using (is_admin())
  with check (reviewed_by = auth.uid());

drop policy if exists "staff_subscription_requests_manage" on public.subscription_requests;
create policy "staff_subscription_requests_manage" on public.subscription_requests for all
  using (has_admin_permission('overview') or has_admin_permission('subscriptions'))
  with check (has_admin_permission('subscriptions') and reviewed_by = auth.uid());

drop policy if exists "subscription_request_admin_update" on public.subscription_requests;
create policy "subscription_request_admin_update" on public.subscription_requests for update
  using (is_admin())
  with check (reviewed_by = auth.uid());

drop policy if exists "staff_payments_manage" on public.payments;
create policy "staff_payments_manage" on public.payments for all
  using (has_admin_permission('payments') or has_admin_permission('sales') or has_admin_permission('reports'))
  with check (has_admin_permission('payments') and verified_by = auth.uid());

drop policy if exists "payments_admin_update" on public.payments;
create policy "payments_admin_update" on public.payments for update
  using (is_admin() or exists (select 1 from public.orders o where o.id = payments.order_id and o.merchant_id = auth.uid()))
  with check (verified_by = auth.uid());

notify pgrst, 'reload schema';
