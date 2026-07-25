-- =====================================================================
-- TindaHub Marketplace — Clinic & Referral System
-- Adds: service_type to merchant_profiles, clinic_services table,
-- referral_appointments table, RPCs for wallet transfers
-- =====================================================================

-- 1. Add service_type to merchant_profiles (allows merchants to offer clinic services)
alter table public.merchant_profiles
  add column if not exists service_type text not null default 'product'
  check (service_type in ('product', 'clinic', 'both'));

-- 2. Clinic Services table
create table if not exists public.clinic_services (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchant_profiles(id) on delete cascade,
  name text not null,
  description text default '',
  service_fee numeric(12,2) not null check (service_fee >= 0),
  referral_fee numeric(12,2) not null check (referral_fee >= 0),
  estimated_duration_minutes integer default 30 check (estimated_duration_minutes > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clinic_services_merchant on public.clinic_services(merchant_id);
create index if not exists idx_clinic_services_active on public.clinic_services(is_active);

-- 3. Referral Appointments table
create table if not exists public.referral_appointments (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchant_profiles(id) on delete cascade,
  reseller_id uuid not null references public.profiles(id) on delete cascade,
  service_id uuid references public.clinic_services(id) on delete set null,
  customer_name text not null,
  customer_phone text default '',
  customer_address text default '',
  referral_fee numeric(12,2) not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  merchant_notes text default '',
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  completed_at timestamptz
);

create index if not exists idx_referral_merchant on public.referral_appointments(merchant_id);
create index if not exists idx_referral_reseller on public.referral_appointments(reseller_id);
create index if not exists idx_referral_status on public.referral_appointments(status);

-- 4. Trigger: update updated_at on clinic_services
create or replace function public.touch_clinic_services_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_clinic_services on public.clinic_services;
create trigger trg_touch_clinic_services
  before update on public.clinic_services
  for each row execute function public.touch_clinic_services_updated_at();

-- 5. RPC: Complete a referral appointment (auto-transfer referral fee)
create or replace function public.complete_referral_appointment(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_merchant_id uuid;
  v_reseller_id uuid;
  v_referral_fee numeric(12,2);
  v_merchant_wallet_id uuid;
  v_reseller_wallet_id uuid;
  v_merchant_balance numeric(12,2);
  v_appointment record;
begin
  -- Only the merchant who owns this appointment can complete it
  select * into v_appointment
  from public.referral_appointments
  where id = p_appointment_id
    and merchant_id = auth.uid()
    and status = 'confirmed'
  for update;

  if v_appointment is null then
    raise exception 'APPOINTMENT_NOT_FOUND_OR_NOT_CONFIRMED';
  end if;

  v_merchant_id := v_appointment.merchant_id;
  v_reseller_id := v_appointment.reseller_id;
  v_referral_fee := v_appointment.referral_fee;

  if v_referral_fee <= 0 then
    raise exception 'INVALID_REFERRAL_FEE';
  end if;

  -- Get merchant wallet
  select id, balance into v_merchant_wallet_id, v_merchant_balance
  from public.wallets
  where owner_id = v_merchant_id
  for update;

  if v_merchant_wallet_id is null then
    raise exception 'MERCHANT_NO_WALLET';
  end if;

  if v_merchant_balance < v_referral_fee then
    raise exception 'INSUFFICIENT_MERCHANT_BALANCE';
  end if;

  -- Get or create reseller wallet
  select id into v_reseller_wallet_id
  from public.wallets
  where owner_id = v_reseller_id
  for update;

  if v_reseller_wallet_id is null then
    insert into public.wallets (owner_id, balance) values (v_reseller_id, 0)
    returning id into v_reseller_wallet_id;
  end if;

  -- Debit merchant wallet
  update public.wallets
  set balance = balance - v_referral_fee, updated_at = now()
  where id = v_merchant_wallet_id;

  -- Credit reseller wallet
  update public.wallets
  set balance = balance + v_referral_fee, updated_at = now()
  where id = v_reseller_wallet_id;

  -- Record transactions
  insert into public.wallet_transactions (wallet_id, amount, type, description)
  values
    (v_merchant_wallet_id, v_referral_fee, 'debit',
     'Referral fee paid to reseller for appointment #' || p_appointment_id),
    (v_reseller_wallet_id, v_referral_fee, 'credit',
     'Referral fee earned from clinic appointment #' || p_appointment_id);

  -- Update appointment status
  update public.referral_appointments
  set status = 'completed',
      completed_at = now()
  where id = p_appointment_id;
end;
$$;

grant execute on function public.complete_referral_appointment(uuid) to authenticated;

-- 6. RPC: Confirm a referral appointment (merchant accepts the referral)
create or replace function public.confirm_referral_appointment(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.referral_appointments
  set status = 'confirmed',
      confirmed_at = now()
  where id = p_appointment_id
    and merchant_id = auth.uid()
    and status = 'pending';

  if not found then
    raise exception 'APPOINTMENT_NOT_FOUND_OR_NOT_PENDING';
  end if;
end;
$$;

grant execute on function public.confirm_referral_appointment(uuid) to authenticated;

-- 7. RPC: Cancel a referral appointment
create or replace function public.cancel_referral_appointment(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.referral_appointments
  set status = 'cancelled'
  where id = p_appointment_id
    and status in ('pending', 'confirmed')
    and (merchant_id = auth.uid() or reseller_id = auth.uid());

  if not found then
    raise exception 'APPOINTMENT_NOT_FOUND_OR_ALREADY_COMPLETED';
  end if;
end;
$$;

grant execute on function public.cancel_referral_appointment(uuid) to authenticated;

-- 8. RPC: Get clinic merchants with their active services
create or replace function public.get_clinic_merchants_with_services()
returns table (
  merchant_id uuid,
  business_name text,
  business_description text,
  business_address text,
  avatar_url text,
  services json
)
language sql
security definer
set search_path = public
as $$
  select
    mp.id as merchant_id,
    mp.business_name,
    mp.business_description,
    mp.business_address,
    p.avatar_url,
    coalesce(
      (select json_agg(
        json_build_object(
          'id', cs.id,
          'name', cs.name,
          'description', cs.description,
          'service_fee', cs.service_fee,
          'referral_fee', cs.referral_fee,
          'estimated_duration_minutes', cs.estimated_duration_minutes
        )
        order by cs.name
       )
       from public.clinic_services cs
       where cs.merchant_id = mp.id and cs.is_active = true
      ),
      '[]'::json
    ) as services
  from public.merchant_profiles mp
  join public.profiles p on p.id = mp.id
  where mp.service_type in ('clinic', 'both')
    and mp.status = 'approved'
  order by mp.business_name;
$$;

grant execute on function public.get_clinic_merchants_with_services() to authenticated;

-- 9. RPC: Get merchant's incoming referrals
create or replace function public.get_merchant_referrals()
returns table (
  id uuid,
  reseller_id uuid,
  reseller_name text,
  service_name text,
  service_fee numeric,
  customer_name text,
  customer_phone text,
  customer_address text,
  referral_fee numeric,
  status text,
  merchant_notes text,
  created_at timestamptz,
  confirmed_at timestamptz,
  completed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    ra.id,
    ra.reseller_id,
    p.full_name as reseller_name,
    cs.name as service_name,
    cs.service_fee,
    ra.customer_name,
    ra.customer_phone,
    ra.customer_address,
    ra.referral_fee,
    ra.status,
    ra.merchant_notes,
    ra.created_at,
    ra.confirmed_at,
    ra.completed_at
  from public.referral_appointments ra
  left join public.clinic_services cs on cs.id = ra.service_id
  join public.profiles p on p.id = ra.reseller_id
  where ra.merchant_id = auth.uid()
  order by ra.created_at desc;
$$;

grant execute on function public.get_merchant_referrals() to authenticated;

-- 10. RPC: Get reseller's referrals
create or replace function public.get_reseller_referrals()
returns table (
  id uuid,
  merchant_id uuid,
  merchant_name text,
  service_name text,
  service_fee numeric,
  customer_name text,
  customer_phone text,
  customer_address text,
  referral_fee numeric,
  status text,
  created_at timestamptz,
  confirmed_at timestamptz,
  completed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    ra.id,
    ra.merchant_id,
    mp.business_name as merchant_name,
    cs.name as service_name,
    cs.service_fee,
    ra.customer_name,
    ra.customer_phone,
    ra.customer_address,
    ra.referral_fee,
    ra.status,
    ra.created_at,
    ra.confirmed_at,
    ra.completed_at
  from public.referral_appointments ra
  left join public.clinic_services cs on cs.id = ra.service_id
  join public.merchant_profiles mp on mp.id = ra.merchant_id
  where ra.reseller_id = auth.uid()
  order by ra.created_at desc;
$$;

grant execute on function public.get_reseller_referrals() to authenticated;

-- 11. RPC: Create a referral appointment
create or replace function public.create_referral_appointment(
  p_merchant_id uuid,
  p_service_id uuid,
  p_customer_name text,
  p_customer_phone text default '',
  p_customer_address text default ''
)
returns public.referral_appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reseller_id uuid := auth.uid();
  v_service record;
  v_appointment public.referral_appointments;
begin
  if v_reseller_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- Validate the service exists and belongs to this merchant
  select * into v_service
  from public.clinic_services
  where id = p_service_id
    and merchant_id = p_merchant_id
    and is_active = true;

  if v_service is null then
    raise exception 'SERVICE_NOT_FOUND_OR_INACTIVE';
  end if;

  if p_customer_name is null or trim(p_customer_name) = '' then
    raise exception 'CUSTOMER_NAME_REQUIRED';
  end if;

  -- Create the referral
  insert into public.referral_appointments (
    merchant_id,
    reseller_id,
    service_id,
    customer_name,
    customer_phone,
    customer_address,
    referral_fee
  ) values (
    p_merchant_id,
    v_reseller_id,
    p_service_id,
    trim(p_customer_name),
    coalesce(p_customer_phone, ''),
    coalesce(p_customer_address, ''),
    v_service.referral_fee
  )
  returning * into v_appointment;

  return v_appointment;
end;
$$;

grant execute on function public.create_referral_appointment(uuid, uuid, text, text, text) to authenticated;

-- 12. RLS Policies
alter table public.clinic_services enable row level security;
alter table public.referral_appointments enable row level security;

-- clinic_services: merchant manages own, public can read active
create policy "clinic_services_public_read_active" on public.clinic_services
  for select using (is_active = true or merchant_id = auth.uid() or public.is_admin());

create policy "clinic_services_merchant_insert" on public.clinic_services
  for insert with check (merchant_id = auth.uid());

create policy "clinic_services_merchant_update" on public.clinic_services
  for update using (merchant_id = auth.uid() or public.is_admin());

create policy "clinic_services_merchant_delete" on public.clinic_services
  for delete using (merchant_id = auth.uid() or public.is_admin());

-- referral_appointments: participants see relevant ones
create policy "referral_merchant_select" on public.referral_appointments
  for select using (merchant_id = auth.uid() or reseller_id = auth.uid() or public.is_admin());

create policy "referral_reseller_insert" on public.referral_appointments
  for insert with check (reseller_id = auth.uid());

create policy "referral_merchant_update" on public.referral_appointments
  for update using (merchant_id = auth.uid() or public.is_admin());

create policy "referral_admin_all" on public.referral_appointments
  for all using (public.is_admin());

-- 13. Add realtime for referral_appointments (optional - for live updates)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'referral_appointments'
  ) then
    alter publication supabase_realtime add table public.referral_appointments;
  end if;
end $$;

