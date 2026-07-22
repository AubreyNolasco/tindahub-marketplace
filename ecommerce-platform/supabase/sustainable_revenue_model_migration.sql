-- RM Hub sustainable three-sided revenue model (2026-07-21).
-- Run after schema.sql, admin_platform_wallet_migration.sql, quantity_discount_migration.sql.
-- Existing orders/balances are preserved. New rates apply only to new orders.

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
alter table public.subscription_requests drop constraint if exists subscription_requests_amount_check;
alter table public.subscription_requests add constraint subscription_requests_amount_check check (created_at<'2026-07-21'::timestamptz or (plan_months=6 and amount=1599) or (plan_months=12 and amount=2799) or (plan_months=24 and amount=4999));
alter table public.revenue_settings enable row level security;
drop policy if exists "revenue_settings_read" on public.revenue_settings;
create policy "revenue_settings_read" on public.revenue_settings for select using(true);
drop policy if exists "revenue_settings_admin" on public.revenue_settings;
create policy "revenue_settings_admin" on public.revenue_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select on public.revenue_settings to anon,authenticated;
grant update on public.revenue_settings to authenticated;

alter table public.products add column if not exists suggested_retail_price numeric(12,2);
alter table public.orders add column if not exists merchant_gross_amount numeric(12,2) not null default 0;
alter table public.orders add column if not exists merchant_net_amount numeric(12,2) not null default 0;
alter table public.orders add column if not exists fee_rate_snapshot jsonb not null default '{}'::jsonb;
alter table public.platform_wallet_transactions add column if not exists revenue_category text;
alter table public.platform_wallet_transactions add column if not exists tax_reserve_amount numeric(12,2) not null default 0;
alter table public.platform_wallet_transactions add column if not exists subscription_request_id uuid references public.subscription_requests(id) on delete set null;
create unique index if not exists platform_revenue_subscription_once_idx on public.platform_wallet_transactions(subscription_request_id) where subscription_request_id is not null and type='credit';

create or replace function public.record_approved_subscription_revenue()
returns trigger language plpgsql security definer set search_path=public as $$
declare reserve_rate numeric(5,2); reserve_amount numeric(12,2);
begin
  if new.status='approved' and old.status='pending' then
    select tax_reserve_percent into reserve_rate from public.revenue_settings where id=true;
    reserve_amount:=round(new.amount*coalesce(reserve_rate,12)/100,2);
    update public.platform_wallet set balance=balance+new.amount,updated_at=now() where id=true;
    insert into public.platform_wallet_transactions(amount,type,description,revenue_category,tax_reserve_amount,subscription_request_id)
    values(new.amount,'credit',new.plan_months||'-month subscription payment','subscription',reserve_amount,new.id)
    on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists trg_record_subscription_revenue on public.subscription_requests;
create trigger trg_record_subscription_revenue after update on public.subscription_requests for each row execute function public.record_approved_subscription_revenue();

create or replace view public.platform_revenue_summary with (security_invoker=true) as
select coalesce(sum(case when type='credit' then amount else -amount end),0)::numeric(14,2) gross_platform_revenue,
       coalesce(sum(case when type='credit' then tax_reserve_amount else 0 end),0)::numeric(14,2) recorded_tax_reserve,
       coalesce(sum(case when type='credit' then amount-tax_reserve_amount else -amount end),0)::numeric(14,2) revenue_after_tax_reserve
from public.platform_wallet_transactions;
grant select on public.platform_revenue_summary to authenticated;

create or replace function public.validate_product_reseller_margin()
returns trigger language plpgsql set search_path=public as $$
declare minimum_margin numeric; buy_price numeric;
begin
  buy_price:=coalesce(new.wholesale_price,new.price);
  new.suggested_retail_price:=coalesce(new.suggested_retail_price,new.price);
  select minimum_reseller_margin_percent into minimum_margin from public.revenue_settings where id=true;
  if new.wholesale_price is not null and (new.wholesale_price<=0 or new.wholesale_price>=new.suggested_retail_price) then raise exception 'WHOLESALE_MUST_BE_BELOW_SUGGESTED_RETAIL'; end if;
  if new.wholesale_price is not null and ((new.suggested_retail_price-buy_price)/new.suggested_retail_price*100)<minimum_margin then raise exception 'RESELLER_MARGIN_BELOW_MINIMUM_%',minimum_margin; end if;
  return new;
end $$;
drop trigger if exists trg_validate_product_reseller_margin on public.products;
create trigger trg_validate_product_reseller_margin before insert or update of price,wholesale_price,suggested_retail_price on public.products for each row execute function public.validate_product_reseller_margin();

create or replace function public.get_secure_order_unit_price(p_product_id uuid,p_quantity integer,p_buyer_role public.user_role)
returns numeric language plpgsql stable security definer set search_path=public as $$
declare p public.products; result numeric(12,2); campaign_percent numeric(5,2):=0;
begin
  select * into p from public.products where id=p_product_id;
  if p.id is null then raise exception 'PRODUCT_UNAVAILABLE'; end if;
  result:=case when p_buyer_role='reseller' then coalesce(p.wholesale_price,p.price) else p.price end;
  if p_buyer_role<>'reseller' then
    select coalesce(max(c.discount_percent),0) into campaign_percent from public.campaigns c join public.merchant_campaigns mc on mc.campaign_id=c.id where mc.merchant_id=p.merchant_id and c.is_active and now() between c.starts_at and c.ends_at;
    result:=round(result*(1-campaign_percent/100),2);
  end if;
  select least(result,coalesce(min((tier->>'price')::numeric),result)) into result from jsonb_array_elements(coalesce(p.discount_tiers,'[]'::jsonb)) tier where p_quantity>=coalesce((tier->>'min_qty')::integer,2147483647);
  return result;
end $$;
revoke all on function public.get_secure_order_unit_price(uuid,integer,public.user_role) from public,anon;

-- Replace the old merchant-wallet debit. Merchant fee is withheld from escrow payout.
drop trigger if exists trg_compute_order_fee on public.orders;
drop function if exists public.compute_order_platform_fee();

create or replace function public.place_order(p_merchant_id uuid,p_shipping_address text,p_items jsonb,p_shipping_fee numeric default 0)
returns public.orders language plpgsql security definer set search_path=public as $$
declare buyer uuid:=auth.uid(); item jsonb; product record; qty integer; unit_price numeric(12,2); subtotal numeric(12,2):=0; product_total numeric(12,2); total numeric(12,2); reseller_fee numeric(12,2):=0; merchant_fee numeric(12,2):=0; buyer_role user_role; wallet record; placed public.orders; settings public.revenue_settings; tax_reserve numeric(12,2);
begin
  if buyer is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_items is null or jsonb_array_length(p_items)=0 then raise exception 'EMPTY_CART'; end if;
  select * into settings from public.revenue_settings where id=true;
  select role into buyer_role from public.profiles where id=buyer;
  select * into wallet from public.wallets where owner_id=buyer for update;
  if wallet is null then raise exception 'NO_WALLET'; end if;
  for item in select * from jsonb_array_elements(p_items) loop
    qty:=(item->>'quantity')::integer;
    select * into product from public.products where id=(item->>'product_id')::uuid for update;
    if product.id is null or product.merchant_id<>p_merchant_id or not product.is_active then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    if qty<product.min_order_qty then raise exception 'BELOW_MIN_ORDER_QTY'; end if;
    if product.stock_quantity<qty then raise exception 'INSUFFICIENT_STOCK'; end if;
    unit_price:=public.get_secure_order_unit_price(product.id,qty,buyer_role);
    subtotal:=subtotal+(unit_price*qty);
  end loop;
  product_total:=subtotal;
  if buyer_role='reseller' then reseller_fee:=greatest(settings.reseller_fee_minimum,least(settings.reseller_fee_maximum,round(product_total*settings.reseller_service_fee_percent/100,2))); end if;
  merchant_fee:=round(product_total*settings.merchant_success_fee_percent/100,2);
  total:=product_total+coalesce(p_shipping_fee,0)+reseller_fee;
  if wallet.balance<total then raise exception 'INSUFFICIENT_BALANCE'; end if;
  insert into public.orders(reseller_id,merchant_id,status,subtotal,shipping_fee,total,reseller_operation_fee,platform_fee,merchant_gross_amount,merchant_net_amount,fee_rate_snapshot,shipping_address)
  values(buyer,p_merchant_id,'confirmed',subtotal,coalesce(p_shipping_fee,0),total,reseller_fee,merchant_fee,product_total,product_total-merchant_fee,jsonb_build_object('merchant_success_fee_percent',settings.merchant_success_fee_percent,'reseller_service_fee_percent',settings.reseller_service_fee_percent,'tax_reserve_percent',settings.tax_reserve_percent),p_shipping_address) returning * into placed;
  for item in select * from jsonb_array_elements(p_items) loop
    qty:=(item->>'quantity')::integer; select * into product from public.products where id=(item->>'product_id')::uuid;
    unit_price:=public.get_secure_order_unit_price(product.id,qty,buyer_role);
    insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,line_total) values(placed.id,product.id,product.name,unit_price,qty,unit_price*qty);
    update public.products set stock_quantity=stock_quantity-qty where id=product.id;
  end loop;
  update public.wallets set balance=balance-total,updated_at=now() where id=wallet.id;
  insert into public.wallet_transactions(wallet_id,amount,type,description,order_id) values(wallet.id,total,'debit','Order '||placed.order_number||' payment',placed.id);
  if reseller_fee>0 then tax_reserve:=round(reseller_fee*settings.tax_reserve_percent/100,2); update public.platform_wallet set balance=balance+reseller_fee,updated_at=now() where id=true; insert into public.platform_wallet_transactions(amount,type,description,order_id,revenue_category,tax_reserve_amount) values(reseller_fee,'credit','Reseller system fee - order '||placed.order_number,placed.id,'reseller_service_fee',tax_reserve); end if;
  return placed;
end $$;
grant execute on function public.place_order(uuid,text,jsonb,numeric) to authenticated;

create or replace function public.quote_order(p_merchant_id uuid,p_items jsonb,p_shipping_fee numeric default 0)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare buyer uuid:=auth.uid(); buyer_role public.user_role; item jsonb; p public.products; qty integer; unit_price numeric(12,2); subtotal numeric(12,2):=0; reseller_fee numeric(12,2):=0; merchant_fee numeric(12,2); settings public.revenue_settings;
begin
  if buyer is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_items is null or jsonb_array_length(p_items)=0 then raise exception 'EMPTY_CART'; end if;
  select role into buyer_role from public.profiles where id=buyer; select * into settings from public.revenue_settings where id=true;
  for item in select * from jsonb_array_elements(p_items) loop qty:=(item->>'quantity')::integer; select * into p from public.products where id=(item->>'product_id')::uuid; if p.id is null or p.merchant_id<>p_merchant_id or not p.is_active then raise exception 'PRODUCT_UNAVAILABLE'; end if; if qty<p.min_order_qty then raise exception 'BELOW_MIN_ORDER_QTY'; end if; if qty>p.stock_quantity then raise exception 'INSUFFICIENT_STOCK'; end if; unit_price:=public.get_secure_order_unit_price(p.id,qty,buyer_role); subtotal:=subtotal+unit_price*qty; end loop;
  if buyer_role='reseller' then reseller_fee:=greatest(settings.reseller_fee_minimum,least(settings.reseller_fee_maximum,round(subtotal*settings.reseller_service_fee_percent/100,2))); end if;
  merchant_fee:=round(subtotal*settings.merchant_success_fee_percent/100,2);
  return jsonb_build_object('subtotal',subtotal,'shipping_fee',coalesce(p_shipping_fee,0),'reseller_fee',reseller_fee,'merchant_fee',merchant_fee,'total',subtotal+coalesce(p_shipping_fee,0)+reseller_fee,'reseller_fee_percent',settings.reseller_service_fee_percent,'merchant_fee_percent',settings.merchant_success_fee_percent,'reseller_fee_minimum',settings.reseller_fee_minimum,'reseller_fee_maximum',settings.reseller_fee_maximum);
end $$;
revoke all on function public.quote_order(uuid,jsonb,numeric) from public,anon;
grant execute on function public.quote_order(uuid,jsonb,numeric) to authenticated;

create or replace function public.handle_order_status_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare wallet_id uuid; payout numeric(12,2); tax_reserve numeric(12,2); tax_rate numeric(5,2);
begin
 if new.status='completed' and old.status in('confirmed','processing','shipped') then
   payout:=coalesce(nullif(new.merchant_net_amount,0),new.subtotal-coalesce(new.platform_fee,0));
   select id into wallet_id from public.wallets where owner_id=new.merchant_id;
   if wallet_id is null then insert into public.wallets(owner_id,balance) values(new.merchant_id,0) returning id into wallet_id; end if;
   update public.wallets set balance=balance+payout,updated_at=now() where id=wallet_id;
   insert into public.wallet_transactions(wallet_id,amount,type,description,order_id) values(wallet_id,payout,'credit','Order '||new.order_number||' merchant net payout',new.id);
   if new.platform_fee>0 then tax_rate:=coalesce((new.fee_rate_snapshot->>'tax_reserve_percent')::numeric,12); tax_reserve:=round(new.platform_fee*tax_rate/100,2); update public.platform_wallet set balance=balance+new.platform_fee,updated_at=now() where id=true; insert into public.platform_wallet_transactions(amount,type,description,order_id,revenue_category,tax_reserve_amount) values(new.platform_fee,'credit','Merchant success fee - order '||new.order_number,new.id,'merchant_success_fee',tax_reserve); end if;
 end if;
 if new.status='cancelled' and old.status in('confirmed','processing','shipped') then
   select id into wallet_id from public.wallets where owner_id=new.reseller_id;
   if wallet_id is not null then update public.wallets set balance=balance+new.total,updated_at=now() where id=wallet_id; insert into public.wallet_transactions(wallet_id,amount,type,description,order_id) values(wallet_id,new.total,'credit','Order '||new.order_number||' cancelled - full refund',new.id); end if;
   if new.reseller_operation_fee>0 then update public.platform_wallet set balance=greatest(0,balance-new.reseller_operation_fee),updated_at=now() where id=true; insert into public.platform_wallet_transactions(amount,type,description,order_id,revenue_category,tax_reserve_amount) values(new.reseller_operation_fee,'debit','Reversed reseller fee - cancelled order '||new.order_number,new.id,'fee_reversal',0); end if;
 end if;
 return new;
end $$;
drop trigger if exists trg_order_status_change on public.orders;
create trigger trg_order_status_change after update on public.orders for each row execute function public.handle_order_status_change();

-- Renew from the later of today or the current expiry. A rejected renewal must
-- never reject an already-approved account or erase its remaining access.
create or replace function public.handle_subscription_request_reviewed()
returns trigger language plpgsql security definer set search_path=public as $$
declare base_expiry timestamptz; new_expiry timestamptz; has_active boolean;
begin
  if new.status='approved' and old.status='pending' then
    select greatest(now(),coalesce(expires_at,now())) into base_expiry from public.subscriptions where owner_id=new.owner_id;
    base_expiry:=coalesce(base_expiry,now()); new_expiry:=base_expiry+make_interval(months=>new.plan_months);
    insert into public.subscriptions(owner_id,status,is_free,started_at,expires_at) values(new.owner_id,'active',false,now(),new_expiry)
    on conflict(owner_id) do update set status='active',is_free=false,expires_at=new_expiry,updated_at=now();
    update public.profiles set account_status='approved',updated_at=now() where id=new.owner_id;
    update public.merchant_profiles set status='approved',subscription_active=true,subscription_expires_at=new_expiry where id=new.owner_id;
  elsif new.status='rejected' and old.status='pending' then
    select exists(select 1 from public.subscriptions where owner_id=new.owner_id and status='active' and expires_at>now()) into has_active;
    if not has_active then update public.profiles set account_status='rejected',updated_at=now() where id=new.owner_id and account_status='pending'; end if;
  end if;
  return new;
end $$;
