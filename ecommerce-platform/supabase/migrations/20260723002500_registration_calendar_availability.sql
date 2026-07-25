create table if not exists public.registration_unavailable_slots (
  id uuid primary key default gen_random_uuid(),
  unavailable_date date not null,
  unavailable_time time,
  reason text not null default 'Registration unavailable' check (char_length(trim(reason)) between 3 and 200),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique nulls not distinct (unavailable_date, unavailable_time)
);

alter table public.registration_unavailable_slots enable row level security;

create policy "admin_manage_registration_unavailable_slots"
on public.registration_unavailable_slots for all to authenticated
using (public.has_admin_permission('registrations'))
with check (public.has_admin_permission('registrations'));

grant select, insert, update, delete on public.registration_unavailable_slots to authenticated;

create or replace function public.get_registration_calendar_availability(p_from date, p_to date)
returns table(unavailable_date date, unavailable_time time, reason text)
language sql security definer set search_path=public as $$
  select s.unavailable_date,s.unavailable_time,s.reason
  from public.registration_unavailable_slots s
  where s.unavailable_date between p_from and p_to
  union all
  select a.preferred_date,a.preferred_time,'Already reserved'::text
  from public.registration_appointments a
  where a.preferred_date between p_from and p_to and a.status<>'cancelled'
$$;

grant execute on function public.get_registration_calendar_availability(date,date) to anon,authenticated;

create or replace function public.guard_registration_schedule()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if (new.preferred_date + new.preferred_time) <= timezone('Asia/Manila',now()) then
    raise exception 'REGISTRATION_TIME_PASSED';
  end if;
  if exists(select 1 from public.registration_unavailable_slots s
    where s.unavailable_date=new.preferred_date
      and (s.unavailable_time is null or s.unavailable_time=new.preferred_time)) then
    raise exception 'REGISTRATION_SLOT_UNAVAILABLE';
  end if;
  if tg_op='INSERT' and exists(select 1 from public.registration_appointments a
    where a.preferred_date=new.preferred_date and a.preferred_time=new.preferred_time and a.status<>'cancelled') then
    raise exception 'REGISTRATION_SLOT_RESERVED';
  end if;
  if tg_op='UPDATE' and (new.preferred_date,new.preferred_time) is distinct from (old.preferred_date,old.preferred_time)
    and exists(select 1 from public.registration_appointments a
      where a.id<>new.id and a.preferred_date=new.preferred_date and a.preferred_time=new.preferred_time and a.status<>'cancelled') then
    raise exception 'REGISTRATION_SLOT_RESERVED';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_registration_schedule on public.registration_appointments;
create trigger trg_guard_registration_schedule
before insert or update of preferred_date,preferred_time on public.registration_appointments
for each row execute function public.guard_registration_schedule();
