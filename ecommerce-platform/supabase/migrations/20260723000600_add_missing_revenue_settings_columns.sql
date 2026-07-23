-- quote_order() was only ever defined in the loose (non-versioned)
-- sustainable_revenue_model_migration.sql file, outside supabase/migrations,
-- so `supabase db push` never applied or tracked it. PostgREST's schema
-- cache had no matching function, causing every reseller checkout to fail
-- with "Could not find the function public.quote_order(...) in the schema
-- cache". The same untracked file also never added the fee columns below,
-- so the first fix attempt failed with "record settings has no field
-- reseller_fee_minimum". Re-create the table columns and function here as a
-- tracked migration.
create table if not exists public.revenue_settings (
  id boolean primary key default true check(id),
  merchant_success_fee_percent numeric(5,2) not null default 3 check(merchant_success_fee_percent between 0 and 25),
  reseller_service_fee_percent numeric(5,2) not null default 1 check(reseller_service_fee_percent between 0 and 10),
  reseller_fee_minimum numeric(12,2) not null default 3 check(reseller_fee_minimum>=0),
  reseller_fee_maximum numeric(12,2) not null default 50 check(reseller_fee_maximum>=reseller_fee_minimum),
  minimum_reseller_margin_percent numeric(5,2) not null default 15 check(minimum_reseller_margin_percent between 0 and 80),
  tax_reserve_percent numeric(5,2) not null default 12 check(tax_reserve_percent between 0 and 100),
  updated_at timestamptz not null default now(), updated_by uuid references public.profiles(id)
);
insert into public.revenue_settings(id) values(true) on conflict(id) do nothing;
alter table public.revenue_settings add column if not exists reseller_fee_minimum numeric(12,2) not null default 3;
alter table public.revenue_settings add column if not exists reseller_fee_maximum numeric(12,2) not null default 50;
alter table public.revenue_settings enable row level security;
drop policy if exists "revenue_settings_read" on public.revenue_settings;
create policy "revenue_settings_read" on public.revenue_settings for select using(true);
drop policy if exists "revenue_settings_admin" on public.revenue_settings;
create policy "revenue_settings_admin" on public.revenue_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select on public.revenue_settings to anon,authenticated;
grant update on public.revenue_settings to authenticated;

create or replace function public.quote_order(p_merchant_id uuid,p_items jsonb,p_shipping_fee numeric default 0)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare buyer uuid:=auth.uid(); buyer_role public.user_role; item jsonb; p public.products; qty integer; unit_price numeric(12,2); subtotal numeric(12,2):=0; reseller_fee numeric(12,2):=0; merchant_fee numeric(12,2); settings public.revenue_settings;
begin
  if buyer is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_items is null or jsonb_array_length(p_items)=0 then raise exception 'EMPTY_CART'; end if;
  select role into buyer_role from public.profiles where id=buyer;
  select * into settings from public.revenue_settings where id=true;
  for item in select * from jsonb_array_elements(p_items) loop
    select * into p from public.products where id=(item->>'product_id')::uuid and merchant_id=p_merchant_id;
    if p is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
    qty:=(item->>'quantity')::integer;
    if qty is null or qty<1 then raise exception 'INVALID_QUANTITY'; end if;
    unit_price:=p.price;
    subtotal:=subtotal+(unit_price*qty);
  end loop;
  if buyer_role='reseller' then reseller_fee:=greatest(settings.reseller_fee_minimum,least(settings.reseller_fee_maximum,round(subtotal*settings.reseller_service_fee_percent/100,2))); end if;
  merchant_fee:=round(subtotal*settings.merchant_success_fee_percent/100,2);
  return jsonb_build_object('subtotal',subtotal,'shipping_fee',coalesce(p_shipping_fee,0),'reseller_fee',reseller_fee,'merchant_fee',merchant_fee,'total',subtotal+coalesce(p_shipping_fee,0)+reseller_fee,'reseller_fee_percent',settings.reseller_service_fee_percent,'merchant_fee_percent',settings.merchant_success_fee_percent,'reseller_fee_minimum',settings.reseller_fee_minimum,'reseller_fee_maximum',settings.reseller_fee_maximum);
end $$;
revoke all on function public.quote_order(uuid,jsonb,numeric) from public,anon;
grant execute on function public.quote_order(uuid,jsonb,numeric) to authenticated;
notify pgrst,'reload schema';
