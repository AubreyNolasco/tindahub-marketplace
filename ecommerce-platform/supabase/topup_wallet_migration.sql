-- =====================================================================
-- Adds wallet top-up requests (merchant + reseller, admin-approved) to an
-- EXISTING JOM HUB project that was already set up with the old schema.sql
-- (i.e. wallets.merchant_id). Safe to run once — every step is idempotent.
--
-- If you're setting up a brand-new project instead, just run schema.sql —
-- it already includes all of this.
-- =====================================================================

-- 1. New enum for top-up request status
do $$ begin
  create type topup_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- 2. Generalize wallets from merchant-only to any profile (merchant or reseller)
do $$ begin
  alter table public.wallets rename column merchant_id to owner_id;
exception when undefined_column then null; end $$;

do $$ begin
  alter table public.wallets drop constraint wallets_merchant_id_fkey;
exception when undefined_object then null; end $$;

do $$ begin
  alter table public.wallets
    add constraint wallets_owner_id_fkey foreign key (owner_id) references public.profiles(id) on delete cascade;
exception when duplicate_object then null; end $$;

-- 3. Give every existing reseller a wallet (new signups get one automatically going forward)
insert into public.wallets (owner_id, balance)
select p.id, 0 from public.profiles p
where p.role = 'reseller'
on conflict (owner_id) do nothing;

-- 4. Top-up requests table
create table if not exists public.topup_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  method payment_method not null,
  reference_number text,
  proof_url text,
  status topup_status not null default 'pending',
  admin_notes text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_topup_requests_owner on public.topup_requests(owner_id);
create index if not exists idx_topup_requests_status on public.topup_requests(status);

alter table public.topup_requests enable row level security;

drop policy if exists "topup_owner_select" on public.topup_requests;
create policy "topup_owner_select" on public.topup_requests
  for select using (owner_id = auth.uid() or public.is_admin());
drop policy if exists "topup_owner_insert" on public.topup_requests;
create policy "topup_owner_insert" on public.topup_requests
  for insert with check (owner_id = auth.uid());
drop policy if exists "topup_admin_update" on public.topup_requests;
create policy "topup_admin_update" on public.topup_requests
  for update using (public.is_admin());

-- 5. Re-point wallet RLS policies at owner_id
drop policy if exists "wallet_owner_select" on public.wallets;
create policy "wallet_owner_select" on public.wallets
  for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "wallet_tx_owner_select" on public.wallet_transactions;
create policy "wallet_tx_owner_select" on public.wallet_transactions
  for select using (
    exists (select 1 from public.wallets w where w.id = wallet_id and w.owner_id = auth.uid())
    or public.is_admin()
  );

-- 6. Re-create trigger functions that referenced wallets.merchant_id
create or replace function public.handle_merchant_approval()
returns trigger language plpgsql as $$
begin
  if new.status = 'approved' and (old.status is distinct from 'approved') then
    insert into public.wallets (owner_id, balance)
    values (new.id, 0)
    on conflict (owner_id) do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.handle_payment_verified()
returns trigger language plpgsql
security definer set search_path = public
as $$
declare
  v_wallet_id uuid;
  v_merchant_id uuid;
begin
  if new.status = 'verified' and (old.status is distinct from 'verified') then
    select merchant_id into v_merchant_id from public.orders where id = new.order_id;
    select id into v_wallet_id from public.wallets where owner_id = v_merchant_id;

    if v_wallet_id is not null then
      update public.wallets set balance = balance + new.amount, updated_at = now() where id = v_wallet_id;
      insert into public.wallet_transactions (wallet_id, amount, type, description, order_id)
      values (v_wallet_id, new.amount, 'credit', 'Payment verified for order', new.order_id);
    end if;

    update public.orders set status = 'confirmed', updated_at = now() where id = new.order_id;
  end if;
  return new;
end;
$$;

-- 7. New trigger: credit wallet when a top-up request is approved
create or replace function public.handle_topup_approved()
returns trigger language plpgsql
security definer set search_path = public
as $$
declare
  v_wallet_id uuid;
begin
  if new.status = 'approved' and (old.status is distinct from 'approved') then
    select id into v_wallet_id from public.wallets where owner_id = new.owner_id;

    if v_wallet_id is null then
      insert into public.wallets (owner_id, balance) values (new.owner_id, 0)
      returning id into v_wallet_id;
    end if;

    update public.wallets set balance = balance + new.amount, updated_at = now() where id = v_wallet_id;
    insert into public.wallet_transactions (wallet_id, amount, type, description)
    values (v_wallet_id, new.amount, 'credit', 'Wallet top-up approved');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_topup_approved on public.topup_requests;
create trigger trg_topup_approved
  after update on public.topup_requests
  for each row execute function public.handle_topup_approved();

-- 8. New resellers get a wallet automatically on signup going forward
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_role user_role;
begin
  begin
    v_role := coalesce(new.raw_user_meta_data->>'role', 'reseller')::user_role;
  exception when others then
    v_role := 'reseller';
  end;

  insert into public.profiles (id, full_name, role, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    v_role,
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;

  if v_role = 'merchant' then
    insert into public.merchant_profiles (id, business_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'business_name', 'My Store'))
    on conflict (id) do nothing;
  else
    insert into public.wallets (owner_id, balance)
    values (new.id, 0)
    on conflict (owner_id) do nothing;
  end if;

  return new;
end;
$$;

-- =====================================================================
-- DONE. Top-up requests will show up in the Admin > Top Up Requests tab.
-- =====================================================================
