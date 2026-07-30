-- Merchant "operate while pending" follow-up requests
--
-- Previously, a Reseller/Merchant was fully redirected away from their
-- dashboard (ProtectedRoute.jsx) until Admin fully approved their account
-- (and, for Merchants, their business permit). This is being loosened so
-- both roles can see their dashboard immediately after signup, while real
-- write actions (posting products, placing orders, ...) stay blocked by
-- the existing RLS/trigger gates on is_approved_account() until their
-- requirements are actually complete.
--
-- For Merchants specifically, a new escape hatch is added: they can
-- request a temporary "follow-up" grace period to operate before their
-- permit is fully approved. Admin reviews the request and sets (and can
-- later adjust) how long the grace period lasts.
--
-- Along the way this also fixes a pre-existing bug: merchant_profile_owner_update
-- required is_approved_account() in its USING clause, which made it
-- impossible for a brand-new (still-pending) Merchant to ever submit their
-- business permit via BusinessPermit.jsx's direct table update -- a
-- chicken-and-egg lock (can't get approved without submitting a permit,
-- can't submit a permit without being approved). protect_merchant_privileges()
-- is extended to guard the newly self-editable permit/grace columns so
-- dropping that requirement is safe.

alter table public.merchant_profiles add column if not exists operate_grace_until timestamptz;

create table if not exists public.merchant_followup_requests (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  operate_until timestamptz,
  admin_notes text not null default '',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id)
);

create unique index if not exists merchant_followup_requests_one_pending
  on public.merchant_followup_requests (merchant_id)
  where status = 'pending';

alter table public.merchant_followup_requests enable row level security;

drop policy if exists "merchant_followup_owner_read" on public.merchant_followup_requests;
create policy "merchant_followup_owner_read" on public.merchant_followup_requests for select
  using (merchant_id = auth.uid() or public.is_admin());

drop policy if exists "merchant_followup_admin_all" on public.merchant_followup_requests;
create policy "merchant_followup_admin_all" on public.merchant_followup_requests for all
  using (public.is_admin());

-- Inserts/updates only ever happen through the security-definer RPCs below,
-- never directly from the client -- no owner insert/update policy needed.

-- Extend the existing self-edit guard to also protect the new permit-review
-- and grace-period columns (previously only status/subscription/trial
-- fields were protected -- see header comment for why this matters).
create or replace function public.protect_merchant_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and coalesce(current_setting('app.demo_role_switch', true), '') <> 'true'
     and (
    new.id is distinct from old.id or new.status is distinct from old.status or
    new.subscription_active is distinct from old.subscription_active or
    new.subscription_expires_at is distinct from old.subscription_expires_at or
    new.trial_ends_at is distinct from old.trial_ends_at or new.created_at is distinct from old.created_at or
    new.business_permit_reviewed_at is distinct from old.business_permit_reviewed_at or
    new.business_permit_reviewed_by is distinct from old.business_permit_reviewed_by or
    new.business_permit_notes is distinct from old.business_permit_notes or
    new.business_permit_expires_at is distinct from old.business_permit_expires_at or
    new.operate_grace_until is distinct from old.operate_grace_until or
    (new.business_permit_status is distinct from old.business_permit_status and
     not (old.business_permit_status in ('missing', 'rejected') and new.business_permit_status = 'pending'))
  ) then raise exception 'PROTECTED_MERCHANT_FIELDS'; end if;
  new.business_name := left(trim(new.business_name), 160);
  new.business_description := left(new.business_description, 2000);
  new.business_address := left(new.business_address, 500);
  return new;
end; $$;

-- Now safe to let owners update their own row regardless of approval
-- status -- the trigger above is the real guard for sensitive fields.
drop policy if exists "merchant_profile_owner_update" on public.merchant_profiles;
create policy "merchant_profile_owner_update" on public.merchant_profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.merchant_has_operate_grace(p_merchant_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select operate_grace_until is not null and operate_grace_until > now()
    from public.merchant_profiles where id = p_merchant_id
  ), false);
$$;

create or replace function public.request_merchant_followup(p_reason text default '')
returns public.merchant_followup_requests
language plpgsql security definer set search_path = public as $$
declare v_request public.merchant_followup_requests;
begin
  if public.current_user_role() <> 'merchant' then raise exception 'MERCHANT_ROLE_REQUIRED'; end if;
  if exists (select 1 from public.merchant_profiles where id = auth.uid() and business_permit_status = 'approved') then
    raise exception 'PERMIT_ALREADY_APPROVED';
  end if;
  if exists (select 1 from public.merchant_followup_requests where merchant_id = auth.uid() and status = 'pending') then
    raise exception 'FOLLOWUP_ALREADY_PENDING';
  end if;
  insert into public.merchant_followup_requests (merchant_id, reason)
  values (auth.uid(), left(trim(coalesce(p_reason, '')), 500))
  returning * into v_request;
  return v_request;
end; $$;
revoke all on function public.request_merchant_followup(text) from public, anon;
grant execute on function public.request_merchant_followup(text) to authenticated;

create or replace function public.admin_review_merchant_followup(
  p_request_id uuid, p_approved boolean, p_operate_until timestamptz default null, p_notes text default ''
) returns void language plpgsql security definer set search_path = public as $$
declare v_merchant_id uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_approved and p_operate_until is null then raise exception 'OPERATE_UNTIL_REQUIRED'; end if;
  update public.merchant_followup_requests set
    status = case when p_approved then 'approved' else 'rejected' end,
    operate_until = case when p_approved then p_operate_until else null end,
    admin_notes = left(trim(coalesce(p_notes, '')), 500),
    reviewed_at = now(),
    reviewed_by = auth.uid()
  where id = p_request_id and status = 'pending'
  returning merchant_id into v_merchant_id;
  if v_merchant_id is null then raise exception 'REQUEST_NOT_FOUND'; end if;
  if p_approved then
    update public.merchant_profiles set operate_grace_until = p_operate_until where id = v_merchant_id;
  end if;
end; $$;
revoke all on function public.admin_review_merchant_followup(uuid, boolean, timestamptz, text) from public, anon;
grant execute on function public.admin_review_merchant_followup(uuid, boolean, timestamptz, text) to authenticated;

create or replace function public.admin_adjust_merchant_operate_grace(p_merchant_id uuid, p_operate_until timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  update public.merchant_profiles set operate_grace_until = p_operate_until where id = p_merchant_id;
end; $$;
revoke all on function public.admin_adjust_merchant_operate_grace(uuid, timestamptz) from public, anon;
grant execute on function public.admin_adjust_merchant_operate_grace(uuid, timestamptz) to authenticated;

create or replace function public.get_admin_merchant_followups()
returns table(
  id uuid, merchant_id uuid, business_name text, full_name text, email text,
  reason text, status text, operate_until timestamptz, admin_notes text,
  business_permit_status text, requested_at timestamptz, reviewed_at timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  return query
    select f.id, f.merchant_id, mp.business_name, p.full_name, p.email,
      f.reason, f.status, f.operate_until, f.admin_notes,
      mp.business_permit_status, f.requested_at, f.reviewed_at
    from public.merchant_followup_requests f
    join public.profiles p on p.id = f.merchant_id
    join public.merchant_profiles mp on mp.id = f.merchant_id
    order by f.requested_at desc;
end; $$;
revoke all on function public.get_admin_merchant_followups() from public, anon;
grant execute on function public.get_admin_merchant_followups() to authenticated;

-- Merchants may operate (post products) either once fully approved, or
-- while an Admin-granted follow-up grace period is active.
drop policy if exists "products_merchant_insert" on public.products;
create policy "products_merchant_insert" on public.products for insert
  with check (merchant_id = auth.uid() and public.current_user_role() = 'merchant'
    and (public.is_approved_account() or public.merchant_has_operate_grace(auth.uid())));

drop policy if exists "products_merchant_update" on public.products;
create policy "products_merchant_update" on public.products for update
  using ((merchant_id = auth.uid() and public.current_user_role() = 'merchant'
    and (public.is_approved_account() or public.merchant_has_operate_grace(auth.uid()))) or public.is_admin())
  with check ((merchant_id = auth.uid() and public.current_user_role() = 'merchant'
    and (public.is_approved_account() or public.merchant_has_operate_grace(auth.uid()))) or public.is_admin());

notify pgrst, 'reload schema';
