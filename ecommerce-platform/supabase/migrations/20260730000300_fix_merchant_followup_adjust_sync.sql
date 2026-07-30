-- admin_adjust_merchant_operate_grace only wrote merchant_profiles.operate_grace_until
-- (the value actually enforced by RLS), but never touched the matching
-- merchant_followup_requests.operate_until on the approved request row --
-- which is what Admin/MerchantFollowups.jsx's list view displays. Result:
-- after Admin uses "Adjust duration", the enforcement was correct but the
-- admin's own list kept showing the original, now-stale expiry date.

create or replace function public.admin_adjust_merchant_operate_grace(p_merchant_id uuid, p_operate_until timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  update public.merchant_profiles set operate_grace_until = p_operate_until where id = p_merchant_id;
  update public.merchant_followup_requests set operate_until = p_operate_until
  where id = (
    select id from public.merchant_followup_requests
    where merchant_id = p_merchant_id and status = 'approved'
    order by reviewed_at desc nulls last
    limit 1
  );
end; $$;

notify pgrst, 'reload schema';
