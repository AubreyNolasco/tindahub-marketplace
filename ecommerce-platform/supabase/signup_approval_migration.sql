-- Paid merchant subscriptions and account approval for new signups.
do $$ begin
  create type account_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- Add the column once and approve only accounts that existed before this feature.
-- Keeping the UPDATE inside the existence check makes this migration safe to rerun:
-- a rerun must never approve genuinely pending new applications.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'account_status'
  ) then
    alter table public.profiles
      add column account_status account_status not null default 'pending';
    update public.profiles set account_status = 'approved';
  end if;
end $$;

create table if not exists public.subscription_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  plan_months integer not null check (plan_months in (6, 12, 24)),
  amount numeric(12,2) not null check (amount in (500, 900, 1800)),
  payment_method payment_method not null,
  reference_number text,
  proof_url text not null,
  status topup_status not null default 'pending',
  admin_notes text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.subscription_requests enable row level security;
drop policy if exists "subscription_request_owner_select" on public.subscription_requests;
create policy "subscription_request_owner_select" on public.subscription_requests
  for select using (owner_id = auth.uid() or public.is_admin());
drop policy if exists "subscription_request_owner_insert" on public.subscription_requests;
create policy "subscription_request_owner_insert" on public.subscription_requests
  for insert with check (owner_id = auth.uid());
drop policy if exists "subscription_request_admin_update" on public.subscription_requests;
create policy "subscription_request_admin_update" on public.subscription_requests
  for update using (public.is_admin());

create or replace function public.handle_subscription_request_reviewed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status = 'pending' then
    insert into public.subscriptions (owner_id, status, is_free, started_at, expires_at)
    values (new.owner_id, 'active', false, now(), now() + make_interval(months => new.plan_months))
    on conflict (owner_id) do update set
      status = 'active', is_free = false, started_at = now(),
      expires_at = now() + make_interval(months => new.plan_months), updated_at = now();
    update public.profiles set account_status = 'approved', updated_at = now() where id = new.owner_id;
    update public.merchant_profiles
      set status = 'approved', subscription_active = true,
          subscription_expires_at = now() + make_interval(months => new.plan_months)
      where id = new.owner_id;
  elsif new.status = 'rejected' and old.status = 'pending' then
    update public.profiles set account_status = 'rejected', updated_at = now() where id = new.owner_id;
  end if;
  return new;
end; $$;

drop trigger if exists trg_subscription_request_reviewed on public.subscription_requests;
create trigger trg_subscription_request_reviewed after update on public.subscription_requests
for each row execute function public.handle_subscription_request_reviewed();

-- Initial reseller top-up approval is also the account approval.
create or replace function public.approve_reseller_from_initial_topup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status = 'pending' then
    update public.profiles set account_status = 'approved', updated_at = now()
      where id = new.owner_id and role = 'reseller' and account_status = 'pending';
  elsif new.status = 'rejected' and old.status = 'pending' then
    update public.profiles set account_status = 'rejected', updated_at = now()
      where id = new.owner_id and role = 'reseller' and account_status = 'pending';
  end if;
  return new;
end; $$;
drop trigger if exists trg_approve_reseller_from_topup on public.topup_requests;
create trigger trg_approve_reseller_from_topup after update on public.topup_requests
for each row execute function public.approve_reseller_from_initial_topup();

-- Replace the signup trigger behavior: no automatic free subscription.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role user_role;
begin
  begin v_role := coalesce(new.raw_user_meta_data->>'role', 'reseller')::user_role;
  exception when others then v_role := 'reseller'; end;
  insert into public.profiles (id, full_name, role, phone, account_status)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), v_role, new.raw_user_meta_data->>'phone', 'pending')
  on conflict (id) do nothing;
  if v_role = 'merchant' then
    insert into public.merchant_profiles (id, business_name, status)
    values (new.id, coalesce(new.raw_user_meta_data->>'business_name', 'My Store'), 'pending') on conflict (id) do nothing;
  else
    insert into public.wallets (owner_id, balance) values (new.id, 0) on conflict (owner_id) do nothing;
  end if;
  return new;
end; $$;
