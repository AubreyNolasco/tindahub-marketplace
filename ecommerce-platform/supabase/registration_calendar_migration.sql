-- Public appointment registrations shown in the Admin dashboard.
create table if not exists public.registration_appointments (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  email text not null check (char_length(trim(email)) between 5 and 254),
  phone text not null check (char_length(trim(phone)) between 7 and 30),
  interested_role text not null check (interested_role in ('merchant', 'reseller', 'not_sure')),
  preferred_date date not null check (preferred_date >= current_date),
  preferred_time time not null,
  notes text not null default '' check (char_length(notes) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'contacted', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists registration_appointments_schedule_idx
  on public.registration_appointments(preferred_date, preferred_time);
create index if not exists registration_appointments_status_idx
  on public.registration_appointments(status, created_at desc);

alter table public.registration_appointments enable row level security;
drop policy if exists "public_create_registration_appointment" on public.registration_appointments;
create policy "public_create_registration_appointment" on public.registration_appointments
  for insert to anon, authenticated with check (status = 'pending');
drop policy if exists "admin_manage_registration_appointments" on public.registration_appointments;
create policy "admin_manage_registration_appointments" on public.registration_appointments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant insert on public.registration_appointments to anon, authenticated;
grant select, update, delete on public.registration_appointments to authenticated;
