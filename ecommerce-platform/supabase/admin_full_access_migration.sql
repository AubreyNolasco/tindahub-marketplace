-- Admin full-access operations: account invitations, manual wallet credits,
-- customer creation, assisted carts, and configurable subscription fees.

create table if not exists public.account_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(trim(email))),
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  role public.user_role not null check (role in ('merchant', 'reseller')),
  phone text,
  business_name text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create table if not exists public.subscription_plans (
  months integer primary key check (months > 0 and months <= 120),
  name text not null,
  fee numeric(12,2) not null check (fee >= 0),
  active boolean not null default true,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
insert into public.subscription_plans(months,name,fee) values
  (6,'Starter',1599),(12,'Growth',2799),(24,'Pro',4999)
on conflict (months) do nothing;

create table if not exists public.admin_cart_items (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.profiles(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  added_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(reseller_id, customer_id, product_id)
);

alter table public.account_invitations enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.admin_cart_items enable row level security;
drop policy if exists "account_invitations_admin_all" on public.account_invitations;
drop policy if exists "subscription_plans_read" on public.subscription_plans;
drop policy if exists "subscription_plans_admin_write" on public.subscription_plans;
drop policy if exists "admin_cart_admin_all" on public.admin_cart_items;
create policy "account_invitations_admin_all" on public.account_invitations for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "subscription_plans_read" on public.subscription_plans for select using (true);
create policy "subscription_plans_admin_write" on public.subscription_plans for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_cart_admin_all" on public.admin_cart_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select,insert,update,delete on public.account_invitations, public.subscription_plans, public.admin_cart_items to authenticated;
grant select on public.subscription_plans to anon;

alter table public.subscription_requests drop constraint if exists subscription_requests_amount_check;
create or replace function public.validate_subscription_request_plan()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_fee numeric;
begin
  select fee into v_fee from subscription_plans where months=new.plan_months and active;
  if v_fee is null or new.amount<>v_fee then raise exception 'INVALID_SUBSCRIPTION_PLAN'; end if;
  return new;
end; $$;
drop trigger if exists trg_validate_subscription_request_plan on public.subscription_requests;
create trigger trg_validate_subscription_request_plan before insert or update of plan_months,amount on public.subscription_requests for each row execute function public.validate_subscription_request_plan();

create or replace function public.admin_manual_topup(p_owner_id uuid, p_amount numeric, p_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_wallet_id uuid; v_request_id uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_amount <= 0 or p_amount > 1000000 then raise exception 'INVALID_AMOUNT'; end if;
  if not exists(select 1 from profiles where id=p_owner_id and role in ('merchant','reseller')) then raise exception 'INVALID_ACCOUNT'; end if;
  insert into wallets(owner_id,balance) values(p_owner_id,0) on conflict(owner_id) do nothing;
  select id into v_wallet_id from wallets where owner_id=p_owner_id for update;
  update wallets set balance=balance+p_amount,updated_at=now() where id=v_wallet_id;
  insert into wallet_transactions(wallet_id,amount,type,description)
  values(v_wallet_id,p_amount,'credit','Admin manual top-up' || case when nullif(trim(p_note),'') is null then '' else ': '||left(trim(p_note),500) end);
  insert into topup_requests(owner_id,amount,method,reference_number,status,admin_notes,reviewed_by,reviewed_at)
  values(p_owner_id,p_amount,'bank_transfer','ADMIN-'||to_char(now(),'YYYYMMDDHH24MISS'),'approved',left(p_note,1000),auth.uid(),now()) returning id into v_request_id;
  return v_request_id;
end; $$;

create or replace function public.admin_create_customer(p_reseller_id uuid,p_name text,p_phone text,p_address text,p_notes text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if not exists(select 1 from profiles where id=p_reseller_id and role='reseller') then raise exception 'RESELLER_REQUIRED'; end if;
  if char_length(trim(p_name))<2 or char_length(trim(p_address))<8 then raise exception 'INVALID_CUSTOMER'; end if;
  insert into customers(reseller_id,name,phone,address,notes) values(p_reseller_id,left(trim(p_name),160),left(trim(p_phone),30),left(trim(p_address),500),left(trim(p_notes),1000)) returning id into v_id;
  return v_id;
end; $$;

create or replace function public.admin_add_cart_item(p_reseller_id uuid,p_customer_id uuid,p_product_id uuid,p_quantity integer)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_stock integer; v_min integer;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if not exists(select 1 from profiles where id=p_reseller_id and role='reseller') then raise exception 'RESELLER_REQUIRED'; end if;
  if p_customer_id is not null and not exists(select 1 from customers where id=p_customer_id and reseller_id=p_reseller_id) then raise exception 'INVALID_CUSTOMER'; end if;
  select stock_quantity,min_order_qty into v_stock,v_min from products where id=p_product_id and is_active;
  if v_stock is null or p_quantity < v_min or p_quantity > v_stock then raise exception 'INVALID_QUANTITY'; end if;
  insert into admin_cart_items(reseller_id,customer_id,product_id,quantity,added_by)
  values(p_reseller_id,p_customer_id,p_product_id,p_quantity,auth.uid())
  on conflict(reseller_id,customer_id,product_id) do update set quantity=excluded.quantity,added_by=auth.uid(),created_at=now()
  returning id into v_id;
  return v_id;
end; $$;

grant execute on function public.admin_manual_topup(uuid,numeric,text), public.admin_create_customer(uuid,text,text,text,text), public.admin_add_cart_item(uuid,uuid,uuid,integer) to authenticated;

create or replace function public.activate_account_invitation()
returns trigger language plpgsql security definer set search_path=public,auth as $$
declare v_inv account_invitations; v_email text;
begin
  select lower(email) into v_email from auth.users where id=new.id;
  select * into v_inv from account_invitations where email=v_email and status='pending' limit 1;
  if v_inv.id is null then return new; end if;
  update profiles set full_name=v_inv.full_name,phone=v_inv.phone,role=v_inv.role,account_status='approved',onboarding_completed=true where id=new.id;
  if v_inv.role='merchant' then
    insert into merchant_profiles(id,business_name,status,subscription_active) values(new.id,coalesce(nullif(trim(v_inv.business_name),''),v_inv.full_name),'approved',true)
    on conflict(id) do update set business_name=excluded.business_name,status='approved',subscription_active=true;
  end if;
  insert into wallets(owner_id,balance) values(new.id,0) on conflict(owner_id) do nothing;
  insert into subscriptions(owner_id,status,is_free,started_at,expires_at) values(new.id,'active',true,now(),now()+interval '1 year') on conflict(owner_id) do nothing;
  update account_invitations set status='accepted',accepted_at=now() where id=v_inv.id;
  return new;
end; $$;
drop trigger if exists trg_activate_account_invitation on public.profiles;
create trigger trg_activate_account_invitation after insert on public.profiles for each row execute function public.activate_account_invitation();

create or replace function public.activate_existing_account_invitation()
returns trigger language plpgsql security definer set search_path=public,auth as $$
declare v_user_id uuid;
begin
  if new.status<>'pending' then return new; end if;
  select id into v_user_id from auth.users where lower(email)=new.email limit 1;
  if v_user_id is null then return new; end if;
  update profiles set full_name=new.full_name,phone=new.phone,role=new.role,account_status='approved',onboarding_completed=true where id=v_user_id;
  if new.role='merchant' then
    insert into merchant_profiles(id,business_name,status,subscription_active) values(v_user_id,coalesce(nullif(trim(new.business_name),''),new.full_name),'approved',true)
    on conflict(id) do update set business_name=excluded.business_name,status='approved',subscription_active=true;
  end if;
  insert into wallets(owner_id,balance) values(v_user_id,0) on conflict(owner_id) do nothing;
  insert into subscriptions(owner_id,status,is_free,started_at,expires_at) values(v_user_id,'active',true,now(),now()+interval '1 year') on conflict(owner_id) do nothing;
  update account_invitations set status='accepted',accepted_at=now() where id=new.id;
  return new;
end; $$;
drop trigger if exists trg_activate_existing_account_invitation on public.account_invitations;
create trigger trg_activate_existing_account_invitation after insert or update of status on public.account_invitations for each row execute function public.activate_existing_account_invitation();
