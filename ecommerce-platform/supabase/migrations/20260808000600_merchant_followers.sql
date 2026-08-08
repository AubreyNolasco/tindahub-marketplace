-- Reseller-follows-Merchant relationship for MerchantStore.jsx.
-- Scoped to this direction only: MerchantStore is behind
-- allowedRoles=['reseller','merchant','admin','staff'] (logged-in platform
-- users), while ResellerStorefront is a public, unauthenticated page with no
-- buyer accounts to attach a follow to -- so a follower feature there would
-- have nothing real to build on.

create table if not exists public.merchant_followers (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.profiles(id) on delete cascade,
  merchant_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (reseller_id, merchant_id)
);

create index if not exists merchant_followers_merchant_idx on public.merchant_followers(merchant_id);

alter table public.merchant_followers enable row level security;

drop policy if exists merchant_followers_owner_read on public.merchant_followers;
create policy merchant_followers_owner_read on public.merchant_followers
  for select using (reseller_id = auth.uid() or is_admin());

drop policy if exists merchant_followers_owner_insert on public.merchant_followers;
create policy merchant_followers_owner_insert on public.merchant_followers
  for insert with check (reseller_id = auth.uid());

drop policy if exists merchant_followers_owner_delete on public.merchant_followers;
create policy merchant_followers_owner_delete on public.merchant_followers
  for delete using (reseller_id = auth.uid() or is_admin());

drop policy if exists merchant_followers_staff_manage on public.merchant_followers;
create policy merchant_followers_staff_manage on public.merchant_followers
  for all using (has_admin_permission('reviews')) with check (has_admin_permission('reviews'));

-- Public-safe aggregate: exposes only a count and the caller's own
-- follow state, never the list of who follows whom (same posture as
-- get_product_sold_counts).
create or replace function public.get_merchant_follow_stats(p_merchant_id uuid)
returns table(follower_count bigint, is_following boolean)
language sql
security definer
set search_path = public
stable
as $$
  select
    (select count(*) from public.merchant_followers where merchant_id = p_merchant_id),
    coalesce((select true from public.merchant_followers where merchant_id = p_merchant_id and reseller_id = auth.uid()), false);
$$;

grant execute on function public.get_merchant_follow_stats(uuid) to authenticated;

-- Only resellers can follow -- a real relationship (resellers repeatedly
-- source from the same merchant), not something a merchant/admin/staff
-- viewing another merchant's store would use.
create or replace function public.toggle_merchant_follow(p_merchant_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_following boolean;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is distinct from 'reseller' then
    raise exception 'Only resellers can follow merchant stores.';
  end if;

  if p_merchant_id = auth.uid() then
    raise exception 'You cannot follow your own store.';
  end if;

  if exists (select 1 from public.merchant_followers where reseller_id = auth.uid() and merchant_id = p_merchant_id) then
    delete from public.merchant_followers where reseller_id = auth.uid() and merchant_id = p_merchant_id;
    v_following := false;
  else
    insert into public.merchant_followers (reseller_id, merchant_id) values (auth.uid(), p_merchant_id);
    v_following := true;
  end if;

  return v_following;
end;
$$;

grant execute on function public.toggle_merchant_follow(uuid) to authenticated;
