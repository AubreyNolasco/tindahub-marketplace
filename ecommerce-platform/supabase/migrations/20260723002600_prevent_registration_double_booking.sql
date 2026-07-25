-- Serialize bookings for the same registration schedule. The availability
-- trigger alone can otherwise allow two concurrent inserts to both pass before
-- either transaction commits.

create index if not exists registration_unavailable_slots_date_idx
on public.registration_unavailable_slots(unavailable_date);

create index if not exists registration_appointments_schedule_idx
on public.registration_appointments(preferred_date,preferred_time)
where status<>'cancelled';

create or replace function public.guard_registration_schedule()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  perform pg_advisory_xact_lock(
    hashtext(new.preferred_date::text || '|' || new.preferred_time::text)
  );

  if (new.preferred_date + new.preferred_time) <= timezone('Asia/Manila',now()) then
    raise exception 'REGISTRATION_TIME_PASSED';
  end if;

  if exists (
    select 1
    from public.registration_unavailable_slots s
    where s.unavailable_date=new.preferred_date
      and (s.unavailable_time is null or s.unavailable_time=new.preferred_time)
  ) then
    raise exception 'REGISTRATION_SLOT_UNAVAILABLE';
  end if;

  if tg_op='INSERT' and exists (
    select 1
    from public.registration_appointments a
    where a.preferred_date=new.preferred_date
      and a.preferred_time=new.preferred_time
      and a.status<>'cancelled'
  ) then
    raise exception 'REGISTRATION_SLOT_RESERVED';
  end if;

  if tg_op='UPDATE'
    and (new.preferred_date,new.preferred_time) is distinct from (old.preferred_date,old.preferred_time)
    and exists (
      select 1
      from public.registration_appointments a
      where a.id<>new.id
        and a.preferred_date=new.preferred_date
        and a.preferred_time=new.preferred_time
        and a.status<>'cancelled'
    )
  then
    raise exception 'REGISTRATION_SLOT_RESERVED';
  end if;

  return new;
end
$$;
