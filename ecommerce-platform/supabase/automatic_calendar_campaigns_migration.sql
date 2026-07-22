-- Automatic Payday and Double Day campaigns using Asia/Manila dates.
-- Defaults: Payday 10% OFF, Double Day 12% OFF. Admins may edit them later.
alter table public.campaigns add column if not exists campaign_kind text not null default 'manual'
  check (campaign_kind in ('manual', 'payday_mid', 'payday_end', 'double_day'));
alter table public.campaigns add column if not exists system_key text;
create unique index if not exists campaigns_system_key_unique
  on public.campaigns(system_key) where system_key is not null;

create or replace function public.ensure_recurring_campaigns()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_month date;
  v_year integer;
  v_month_number integer;
  v_month_end date;
  v_double_day date;
begin
  select id into v_admin_id from public.profiles where role = 'admin' order by created_at limit 1;
  if v_admin_id is null then return; end if;

  -- Generate the current month plus the next two months so merchants can join early.
  for v_month in
    select generate_series(
      date_trunc('month', timezone('Asia/Manila', now()))::date,
      (date_trunc('month', timezone('Asia/Manila', now())) + interval '2 months')::date,
      interval '1 month'
    )::date
  loop
    v_year := extract(year from v_month);
    v_month_number := extract(month from v_month);
    v_month_end := (v_month + interval '1 month - 1 day')::date;
    v_double_day := make_date(v_year, v_month_number, v_month_number);

    insert into public.campaigns (name, description, discount_percent, starts_at, ends_at, created_by, campaign_kind, system_key)
    values (
      to_char(v_month, 'FMMonth YYYY') || ' Mid-Month Payday Sale',
      'Automatic Payday campaign from the 14th through the 16th of the month.',
      10,
      (v_month + 13)::timestamp at time zone 'Asia/Manila',
      (v_month + 16)::timestamp at time zone 'Asia/Manila',
      v_admin_id, 'payday_mid', format('payday-mid-%s-%s', v_year, lpad(v_month_number::text, 2, '0'))
    ) on conflict (system_key) where system_key is not null do nothing;

    insert into public.campaigns (name, description, discount_percent, starts_at, ends_at, created_by, campaign_kind, system_key)
    values (
      to_char(v_month, 'FMMonth YYYY') || ' End-of-Month Payday Sale',
      'Automatic Payday campaign from the 27th through the final day of the month.',
      10,
      (v_month + 26)::timestamp at time zone 'Asia/Manila',
      (v_month + interval '1 month')::timestamp at time zone 'Asia/Manila',
      v_admin_id, 'payday_end', format('payday-end-%s-%s', v_year, lpad(v_month_number::text, 2, '0'))
    ) on conflict (system_key) where system_key is not null do nothing;

    insert into public.campaigns (name, description, discount_percent, starts_at, ends_at, created_by, campaign_kind, system_key)
    values (
      format('%s.%s Double Day Sale', v_month_number, v_month_number),
      'Automatic three-day Double Day marketplace campaign.',
      12,
      v_double_day::timestamp at time zone 'Asia/Manila',
      (v_double_day + 3)::timestamp at time zone 'Asia/Manila',
      v_admin_id, 'double_day', format('double-day-%s-%s', v_year, lpad(v_month_number::text, 2, '0'))
    ) on conflict (system_key) where system_key is not null do nothing;
  end loop;
end;
$$;

revoke all on function public.ensure_recurring_campaigns() from public;
grant execute on function public.ensure_recurring_campaigns() to authenticated;

-- Create the first calendar campaigns as soon as this migration is run.
select public.ensure_recurring_campaigns();
