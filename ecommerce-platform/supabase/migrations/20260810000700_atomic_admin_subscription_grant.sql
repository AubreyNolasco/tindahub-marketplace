-- =====================================================================
-- Admin/Subscriptions.jsx's manual grant/extend flow (SubscriptionModal.
-- handleSave) did two independent, sequential REST calls: an upsert on
-- subscriptions, then a separate update on merchant_profiles.
-- subscription_active/subscription_expires_at. subscriptions.expires_at
-- is what's actually enforced server-side
-- (enforce_active_merchant_subscription(), 20260722000500), while
-- merchant_profiles.subscription_expires_at is only the cached copy
-- ProtectedRoute.jsx reads to decide the /subscription-locked redirect.
-- If the second call failed after the first succeeded (RLS hiccup,
-- dropped connection, closed tab), a merchant could be fully unlocked
-- server-side while the dashboard still redirected them to the lockout
-- page, or the reverse. handle_subscription_request_reviewed() (the
-- automated subscription-request review path) already does the
-- equivalent update atomically in one trigger -- this gives the manual
-- admin-grant path the same guarantee.
-- =====================================================================

create or replace function public.admin_grant_subscription(p_owner_id uuid, p_status text, p_expires_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_role text;
begin
  -- Subscriptions.jsx is reachable by staff scoped to the 'subscriptions'
  -- admin_permission, not just full admins (AdminPermissionRoute
  -- permission="subscriptions", staff_subscriptions_manage RLS policy) --
  -- matches that scoping rather than requiring is_admin().
  if not public.has_admin_permission('subscriptions') then raise exception 'ADMIN_REQUIRED'; end if;
  if p_status not in ('active', 'expired', 'cancelled') then raise exception 'INVALID_SUBSCRIPTION_STATUS'; end if;

  select role into v_role from public.profiles where id = p_owner_id;
  if v_role is null then raise exception 'PROFILE_NOT_FOUND'; end if;

  insert into public.subscriptions(owner_id, status, is_free, started_at, expires_at, updated_at)
  values (p_owner_id, p_status, false, now(), p_expires_at, now())
  on conflict (owner_id) do update set
    status = excluded.status, is_free = false, expires_at = excluded.expires_at, updated_at = now();

  if v_role = 'merchant' then
    update public.merchant_profiles set
      subscription_active = (p_status = 'active'),
      subscription_expires_at = p_expires_at
    where id = p_owner_id;
  end if;
end;
$$;

revoke all on function public.admin_grant_subscription(uuid, text, timestamptz) from public, anon;
grant execute on function public.admin_grant_subscription(uuid, text, timestamptz) to authenticated;

notify pgrst, 'reload schema';
