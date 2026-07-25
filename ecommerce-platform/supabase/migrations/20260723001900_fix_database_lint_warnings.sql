-- Keep the accepted shipping quote authoritative while validating the
-- compatibility parameter sent by existing clients, and remove dead campaign
-- maintenance state reported by plpgsql_check.

create or replace function public.set_order_delivery(
  p_order_id uuid,
  p_provider text,
  p_tracking text,
  p_pickup timestamptz,
  p_estimated timestamptz,
  p_proof_url text,
  p_actual_fee numeric default null
)
returns public.orders
language plpgsql
security definer
set search_path=public
as $$
declare result public.orders;
begin
  if char_length(trim(coalesce(p_provider,'')))<2
    or char_length(trim(coalesce(p_tracking,'')))<3 then
    raise exception 'DELIVERY_DETAILS_REQUIRED';
  end if;

  update public.orders
  set delivery_provider=left(trim(p_provider),120),
      tracking_number=left(trim(p_tracking),120),
      pickup_scheduled_at=p_pickup,
      estimated_delivery_at=p_estimated,
      dispatch_proof_url=nullif(trim(p_proof_url),''),
      actual_shipping_fee=proposed_shipping_fee,
      shipped_at=now(),
      auto_complete_at=greatest(coalesce(p_estimated,now()),now())+interval '7 days',
      status='shipped'
  where id=p_order_id
    and merchant_id=auth.uid()
    and status='processing'
    and shipping_fee_confirmation_status='accepted'
    and proposed_shipping_fee is not null
    and (p_actual_fee is null or round(p_actual_fee,2)=proposed_shipping_fee)
  returning * into result;

  if result.id is null then
    raise exception 'RESELLER_SHIPPING_CONFIRMATION_REQUIRED';
  end if;
  return result;
end
$$;

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
  v_double_day date;
begin
  select id into v_admin_id
  from public.profiles
  where role = 'admin'
  order by created_at
  limit 1;
  if v_admin_id is null then return; end if;

  for v_month in
    select generate_series(
      date_trunc('month', timezone('Asia/Manila', now()))::date,
      (date_trunc('month', timezone('Asia/Manila', now())) + interval '2 months')::date,
      interval '1 month'
    )::date
  loop
    v_year := extract(year from v_month);
    v_month_number := extract(month from v_month);
    v_double_day := make_date(v_year, v_month_number, v_month_number);

    insert into public.campaigns (name,description,discount_percent,starts_at,ends_at,created_by,campaign_kind,system_key)
    values (
      to_char(v_month,'FMMonth YYYY') || ' Mid-Month Payday Sale',
      'Automatic Payday campaign from the 14th through the 16th of the month.',
      10,(v_month+13)::timestamp at time zone 'Asia/Manila',
      (v_month+16)::timestamp at time zone 'Asia/Manila',
      v_admin_id,'payday_mid',
      format('payday-mid-%s-%s',v_year,lpad(v_month_number::text,2,'0'))
    ) on conflict (system_key) where system_key is not null do nothing;

    insert into public.campaigns (name,description,discount_percent,starts_at,ends_at,created_by,campaign_kind,system_key)
    values (
      to_char(v_month,'FMMonth YYYY') || ' End-of-Month Payday Sale',
      'Automatic Payday campaign from the 27th through the final day of the month.',
      10,(v_month+26)::timestamp at time zone 'Asia/Manila',
      (v_month+interval '1 month')::timestamp at time zone 'Asia/Manila',
      v_admin_id,'payday_end',
      format('payday-end-%s-%s',v_year,lpad(v_month_number::text,2,'0'))
    ) on conflict (system_key) where system_key is not null do nothing;

    insert into public.campaigns (name,description,discount_percent,starts_at,ends_at,created_by,campaign_kind,system_key)
    values (
      format('%s.%s Double Day Sale',v_month_number,v_month_number),
      'Automatic three-day Double Day marketplace campaign.',
      12,v_double_day::timestamp at time zone 'Asia/Manila',
      (v_double_day+3)::timestamp at time zone 'Asia/Manila',
      v_admin_id,'double_day',
      format('double-day-%s-%s',v_year,lpad(v_month_number::text,2,'0'))
    ) on conflict (system_key) where system_key is not null do nothing;
  end loop;
end
$$;

revoke all on function public.ensure_recurring_campaigns() from public;
grant execute on function public.ensure_recurring_campaigns() to authenticated;

notify pgrst,'reload schema';
