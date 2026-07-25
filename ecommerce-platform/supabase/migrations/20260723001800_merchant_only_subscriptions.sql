-- Subscriptions are a Merchant-only product. Resellers use wallet top-ups
-- and transaction fees, but never need or receive a subscription.

delete from public.subscriptions s
using public.profiles p
where p.id = s.owner_id
  and p.role = 'reseller';

create or replace function public.require_merchant_subscription_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = new.owner_id
      and p.role = 'merchant'
  ) then
    raise exception 'MERCHANT_SUBSCRIPTION_ONLY';
  end if;
  return new;
end
$$;

drop trigger if exists require_merchant_subscription_owner on public.subscriptions;
create trigger require_merchant_subscription_owner
before insert or update of owner_id on public.subscriptions
for each row execute function public.require_merchant_subscription_owner();

drop trigger if exists require_merchant_subscription_request_owner on public.subscription_requests;
create trigger require_merchant_subscription_request_owner
before insert or update of owner_id on public.subscription_requests
for each row execute function public.require_merchant_subscription_owner();

create or replace function public.activate_account_invitation()
returns trigger language plpgsql security definer set search_path=public,auth as $$
declare v_inv public.account_invitations; v_email text;
begin
  select lower(email) into v_email from auth.users where id=new.id;
  select * into v_inv from public.account_invitations where email=v_email and status='pending' limit 1;
  if v_inv.id is null then return new; end if;
  update public.profiles
  set full_name=v_inv.full_name,phone=v_inv.phone,role=v_inv.role,
      account_status=case when v_inv.role='merchant' then 'pending' else 'approved' end,
      onboarding_completed=true
  where id=new.id;
  if v_inv.role='merchant' then
    insert into public.merchant_profiles(id,business_name,status,subscription_active)
    values(new.id,coalesce(nullif(trim(v_inv.business_name),''),v_inv.full_name),'pending',false)
    on conflict(id) do update
    set business_name=excluded.business_name,status='pending',subscription_active=false;
  end if;
  insert into public.wallets(owner_id,balance) values(new.id,0) on conflict(owner_id) do nothing;
  update public.account_invitations set status='accepted',accepted_at=now() where id=v_inv.id;
  return new;
end $$;

create or replace function public.activate_existing_account_invitation()
returns trigger language plpgsql security definer set search_path=public,auth as $$
declare v_user_id uuid;
begin
  if new.status<>'pending' then return new; end if;
  select id into v_user_id from auth.users where lower(email)=new.email limit 1;
  if v_user_id is null then return new; end if;
  update public.profiles
  set full_name=new.full_name,phone=new.phone,role=new.role,
      account_status=case when new.role='merchant' then 'pending' else 'approved' end,
      onboarding_completed=true
  where id=v_user_id;
  if new.role='merchant' then
    insert into public.merchant_profiles(id,business_name,status,subscription_active)
    values(v_user_id,coalesce(nullif(trim(new.business_name),''),new.full_name),'pending',false)
    on conflict(id) do update
    set business_name=excluded.business_name,status='pending',subscription_active=false;
  end if;
  insert into public.wallets(owner_id,balance) values(v_user_id,0) on conflict(owner_id) do nothing;
  update public.account_invitations set status='accepted',accepted_at=now() where id=new.id;
  return new;
end $$;

notify pgrst,'reload schema';
