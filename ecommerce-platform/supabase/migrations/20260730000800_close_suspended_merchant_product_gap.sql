-- sync_suspended_merchant_products() only hides a suspended merchant's
-- EXISTING products (is_active=false) -- but products_merchant_insert/update
-- only ever checked profiles.account_status (is_approved_account()), never
-- merchant_profiles.status. Since suspending a merchant only touches
-- merchant_profiles.status (not profiles.account_status, which stays
-- 'approved'), a suspended merchant could still post brand-new active
-- products the whole time. Closing that gap: suspended now also blocks
-- product insert/update outright, regardless of account_status or any
-- active follow-up grace.

drop policy if exists "products_merchant_insert" on public.products;
create policy "products_merchant_insert" on public.products for insert
  with check (merchant_id = auth.uid() and public.current_user_role() = 'merchant'
    and (public.is_approved_account() or public.merchant_has_operate_grace(auth.uid()))
    and not exists (select 1 from public.merchant_profiles where id = auth.uid() and status = 'suspended'));

drop policy if exists "products_merchant_update" on public.products;
create policy "products_merchant_update" on public.products for update
  using ((merchant_id = auth.uid() and public.current_user_role() = 'merchant'
    and (public.is_approved_account() or public.merchant_has_operate_grace(auth.uid()))
    and not exists (select 1 from public.merchant_profiles where id = auth.uid() and status = 'suspended')) or public.is_admin())
  with check ((merchant_id = auth.uid() and public.current_user_role() = 'merchant'
    and (public.is_approved_account() or public.merchant_has_operate_grace(auth.uid()))
    and not exists (select 1 from public.merchant_profiles where id = auth.uid() and status = 'suspended')) or public.is_admin());

notify pgrst, 'reload schema';
