-- JOM HUB operational process hardening.
-- Additive migration: preserves the current 1% reseller / 3% merchant fee engine.

alter table public.orders add column if not exists delivery_provider text;
alter table public.orders add column if not exists tracking_number text;
alter table public.orders add column if not exists pickup_scheduled_at timestamptz;
alter table public.orders add column if not exists shipped_at timestamptz;
alter table public.orders add column if not exists estimated_delivery_at timestamptz;
alter table public.orders add column if not exists dispatch_proof_url text;
alter table public.orders add column if not exists delivered_at timestamptz;
alter table public.orders add column if not exists actual_shipping_fee numeric(12,2) check(actual_shipping_fee is null or actual_shipping_fee >= 0);
alter table public.orders add column if not exists auto_complete_at timestamptz;
alter table public.profiles add column if not exists payout_destination_updated_at timestamptz;
alter table public.withdrawal_requests add column if not exists transfer_proof_url text;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('delivery-proofs','delivery-proofs',false,8388608,array['image/jpeg','image/png','image/webp','application/pdf']),
('withdrawal-proofs','withdrawal-proofs',false,8388608,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists delivery_proof_merchant_upload on storage.objects;
create policy delivery_proof_merchant_upload on storage.objects for insert to authenticated with check(bucket_id='delivery-proofs' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists delivery_proof_participant_read on storage.objects;
create policy delivery_proof_participant_read on storage.objects for select to authenticated using(bucket_id='delivery-proofs' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin() or exists(select 1 from public.orders o where o.id::text=(storage.foldername(name))[2] and o.reseller_id=auth.uid())));
drop policy if exists withdrawal_proof_admin_upload on storage.objects;
create policy withdrawal_proof_admin_upload on storage.objects for insert to authenticated with check(bucket_id='withdrawal-proofs' and public.is_admin());
drop policy if exists withdrawal_proof_owner_read on storage.objects;
create policy withdrawal_proof_owner_read on storage.objects for select to authenticated using(bucket_id='withdrawal-proofs' and (public.is_admin() or exists(select 1 from public.withdrawal_requests w where w.id::text=(storage.foldername(name))[2] and w.owner_id=auth.uid())));

create table if not exists public.order_cases (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  opened_by uuid not null references public.profiles(id), case_type text not null check(case_type in('cancellation','dispute','return','replacement','refund')),
  status text not null default 'open' check(status in('open','merchant_review','admin_review','approved','rejected','resolved')),
  reason text not null check(char_length(trim(reason)) between 10 and 1000), evidence_url text,
  merchant_response text, resolution_notes text, resolved_by uuid references public.profiles(id), resolved_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists one_open_case_per_order_idx on public.order_cases(order_id) where status in('open','merchant_review','admin_review');
create index if not exists order_cases_status_idx on public.order_cases(status,created_at desc);

create table if not exists public.customer_payment_records (
  id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.orders(id) on delete cascade,
  reseller_id uuid not null references public.profiles(id), customer_id uuid references public.customers(id) on delete set null,
  expected_amount numeric(12,2) not null check(expected_amount >= 0), received_amount numeric(12,2) not null default 0 check(received_amount >= 0),
  status text not null default 'unpaid' check(status in('unpaid','partially_paid','paid','refunded')),
  payment_method text, payment_reference text, paid_at timestamptz, notes text, updated_at timestamptz not null default now()
);

create table if not exists public.order_inventory_restorations (
  order_id uuid primary key references public.orders(id) on delete cascade, restored_at timestamptz not null default now()
);

alter table public.order_cases enable row level security;
alter table public.customer_payment_records enable row level security;
alter table public.order_inventory_restorations enable row level security;
drop policy if exists order_cases_participant_read on public.order_cases;
create policy order_cases_participant_read on public.order_cases for select to authenticated using(
  opened_by=auth.uid() or exists(select 1 from public.orders o where o.id=order_id and (o.reseller_id=auth.uid() or o.merchant_id=auth.uid())) or public.is_admin()
);
drop policy if exists customer_payment_owner_all on public.customer_payment_records;
create policy customer_payment_owner_all on public.customer_payment_records for all to authenticated using(reseller_id=auth.uid() or public.is_admin()) with check(reseller_id=auth.uid() or public.is_admin());
grant select on public.order_cases to authenticated;
grant select,insert,update on public.customer_payment_records to authenticated;

create or replace function public.open_order_case(p_order_id uuid,p_case_type text,p_reason text,p_evidence_url text default null)
returns public.order_cases language plpgsql security definer set search_path=public as $$
declare o public.orders; result public.order_cases;
begin
  select * into o from public.orders where id=p_order_id;
  if o.id is null or auth.uid() not in(o.reseller_id,o.merchant_id) then raise exception 'ORDER_ACCESS_DENIED'; end if;
  if o.status in('completed','cancelled') and p_case_type='cancellation' then raise exception 'ORDER_CANNOT_BE_CANCELLED'; end if;
  if p_case_type not in('cancellation','dispute','return','replacement','refund') then raise exception 'INVALID_CASE_TYPE'; end if;
  insert into public.order_cases(order_id,opened_by,case_type,status,reason,evidence_url)
  values(o.id,auth.uid(),p_case_type,case when p_case_type='cancellation' and o.status='confirmed' then 'merchant_review' else 'admin_review' end,left(trim(p_reason),1000),nullif(trim(p_evidence_url),'')) returning * into result;
  return result;
end $$;

create or replace function public.review_order_case(p_case_id uuid,p_approve boolean,p_notes text default null)
returns public.order_cases language plpgsql security definer set search_path=public as $$
declare c public.order_cases; o public.orders; result public.order_cases;
begin
  select * into c from public.order_cases where id=p_case_id for update;
  select * into o from public.orders where id=c.order_id;
  if c.id is null then raise exception 'CASE_NOT_FOUND'; end if;
  if not public.is_admin() and not(o.merchant_id=auth.uid() and c.status='merchant_review' and c.case_type='cancellation') then raise exception 'CASE_REVIEW_DENIED'; end if;
  if p_approve and c.case_type='cancellation' then perform set_config('app.case_resolution','true',true); update public.orders set status='cancelled' where id=o.id and status in('confirmed','processing','shipped'); end if;
  update public.order_cases set status=case when p_approve then 'resolved' else 'rejected' end,resolution_notes=left(trim(coalesce(p_notes,'')),1000),resolved_by=auth.uid(),resolved_at=now(),updated_at=now() where id=c.id returning * into result;
  return result;
end $$;

create or replace function public.enforce_order_transition()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_role public.user_role;
begin
  if public.is_admin() or new.status=old.status or current_setting('app.case_resolution',true)='true' or current_setting('app.operational_maintenance',true)='true' then return new; end if;
  select role into v_role from public.profiles where id=auth.uid();
  if v_role='merchant' and old.merchant_id=auth.uid() and ((old.status='payment_review' and new.status in('confirmed','cancelled')) or (old.status='confirmed' and new.status='processing') or (old.status='processing' and new.status='shipped')) then return new; end if;
  if old.reseller_id=auth.uid() and old.status='shipped' and new.status='completed' then return new; end if;
  raise exception 'INVALID_ORDER_STATUS_TRANSITION';
end $$;

create or replace function public.set_order_delivery(p_order_id uuid,p_provider text,p_tracking text,p_pickup timestamptz,p_estimated timestamptz,p_proof_url text,p_actual_fee numeric default null)
returns public.orders language plpgsql security definer set search_path=public as $$
declare result public.orders;
begin
  if char_length(trim(coalesce(p_provider,'')))<2 or char_length(trim(coalesce(p_tracking,'')))<3 then raise exception 'DELIVERY_DETAILS_REQUIRED'; end if;
  update public.orders set delivery_provider=left(trim(p_provider),120),tracking_number=left(trim(p_tracking),120),pickup_scheduled_at=p_pickup,
    estimated_delivery_at=p_estimated,dispatch_proof_url=nullif(trim(p_proof_url),''),actual_shipping_fee=p_actual_fee,
    shipped_at=now(),auto_complete_at=greatest(coalesce(p_estimated,now()),now())+interval '7 days',status='shipped'
  where id=p_order_id and merchant_id=auth.uid() and status='processing' returning * into result;
  if result.id is null then raise exception 'ORDER_NOT_READY_TO_SHIP'; end if; return result;
end $$;

create or replace function public.record_customer_payment(p_order_id uuid,p_expected numeric,p_received numeric,p_method text,p_reference text default null,p_notes text default null)
returns public.customer_payment_records language plpgsql security definer set search_path=public as $$
declare o public.orders; result public.customer_payment_records; payment_status text;
begin
  select * into o from public.orders where id=p_order_id and reseller_id=auth.uid(); if o.id is null then raise exception 'ORDER_ACCESS_DENIED'; end if;
  if p_expected<0 or p_received<0 then raise exception 'INVALID_AMOUNT'; end if;
  payment_status:=case when p_received=0 then 'unpaid' when p_received<p_expected then 'partially_paid' else 'paid' end;
  insert into public.customer_payment_records(order_id,reseller_id,customer_id,expected_amount,received_amount,status,payment_method,payment_reference,paid_at,notes)
  values(o.id,auth.uid(),o.customer_id,p_expected,p_received,payment_status,nullif(trim(p_method),''),nullif(trim(p_reference),''),case when payment_status='paid' then now() end,left(trim(coalesce(p_notes,'')),1000))
  on conflict(order_id) do update set expected_amount=excluded.expected_amount,received_amount=excluded.received_amount,status=excluded.status,payment_method=excluded.payment_method,payment_reference=excluded.payment_reference,paid_at=excluded.paid_at,notes=excluded.notes,updated_at=now()
  returning * into result; return result;
end $$;

create or replace function public.restore_cancelled_order_stock()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='cancelled' and old.status<>'cancelled' then
    insert into public.order_inventory_restorations(order_id) values(new.id) on conflict do nothing;
    if found then update public.products p set stock_quantity=p.stock_quantity+i.quantity from public.order_items i where i.order_id=new.id and p.id=i.product_id; end if;
  end if; return new;
end $$;
drop trigger if exists trg_restore_cancelled_order_stock on public.orders;
create trigger trg_restore_cancelled_order_stock after update on public.orders for each row execute function public.restore_cancelled_order_stock();

create or replace function public.complete_due_deliveries()
returns integer language plpgsql security definer set search_path=public as $$
declare changed integer;
begin
  perform set_config('app.operational_maintenance','true',true);
  update public.orders o set status='completed',delivered_at=coalesce(delivered_at,now())
  where status='shipped' and auto_complete_at<=now() and not exists(select 1 from public.order_cases c where c.order_id=o.id and c.status in('open','merchant_review','admin_review'));
  get diagnostics changed=row_count; return changed;
end $$;

create or replace function public.enforce_active_merchant_subscription()
returns trigger language plpgsql security definer set search_path=public as $$
declare merchant uuid:=case when tg_table_name='products' then new.merchant_id else new.merchant_id end;
begin
  if not exists(select 1 from public.subscriptions s where s.owner_id=merchant and s.status='active' and s.expires_at>now()) then raise exception 'MERCHANT_SUBSCRIPTION_REQUIRED'; end if;
  return new;
end $$;
drop trigger if exists trg_product_active_subscription on public.products;
create trigger trg_product_active_subscription before insert or update of is_active on public.products for each row when(new.is_active=true) execute function public.enforce_active_merchant_subscription();
drop trigger if exists trg_order_active_merchant_subscription on public.orders;
create trigger trg_order_active_merchant_subscription before insert on public.orders for each row execute function public.enforce_active_merchant_subscription();

create or replace function public.run_operational_maintenance()
returns jsonb language plpgsql security definer set search_path=public as $$
declare hidden integer; completed integer;
begin
  update public.products p set is_active=false where is_active and exists(select 1 from public.subscriptions s where s.owner_id=p.merchant_id and (s.status<>'active' or s.expires_at<=now())); get diagnostics hidden=row_count;
  completed:=public.complete_due_deliveries(); return jsonb_build_object('products_paused',hidden,'orders_completed',completed);
end $$;

create or replace function public.enforce_withdrawal_limits()
returns trigger language plpgsql security definer set search_path=public as $$
declare today_total numeric; changed_recently boolean;
begin
  if new.amount<500 then raise exception 'MINIMUM_WITHDRAWAL_500'; end if;
  select coalesce(sum(amount),0) into today_total from public.withdrawal_requests where owner_id=new.owner_id and created_at>=date_trunc('day',now()) and status<>'rejected';
  if today_total+new.amount>100000 then raise exception 'DAILY_WITHDRAWAL_LIMIT_100000'; end if;
  select payout_destination_updated_at>now()-interval '24 hours' into changed_recently from public.profiles where id=new.owner_id;
  if changed_recently then raise exception 'ACCOUNT_CHANGE_COOLDOWN'; end if;
  return new;
end $$;
drop trigger if exists trg_enforce_withdrawal_limits on public.withdrawal_requests;
create trigger trg_enforce_withdrawal_limits before insert on public.withdrawal_requests for each row execute function public.enforce_withdrawal_limits();
create unique index if not exists withdrawal_transfer_reference_unique_idx on public.withdrawal_requests(lower(regexp_replace(transfer_reference,'[^a-zA-Z0-9]','','g'))) where transfer_reference is not null;

create or replace function public.sync_suspended_merchant_products()
returns trigger language plpgsql security definer set search_path=public as $$ begin if new.status in('suspended','rejected') and old.status is distinct from new.status then update public.products set is_active=false where merchant_id=new.id; end if; return new; end $$;
drop trigger if exists trg_sync_suspended_merchant_products on public.merchant_profiles;
create trigger trg_sync_suspended_merchant_products after update of status on public.merchant_profiles for each row execute function public.sync_suspended_merchant_products();

create or replace function public.track_payout_destination_change()
returns trigger language plpgsql set search_path=public as $$ begin if new.payout_provider is distinct from old.payout_provider or new.payout_account_name is distinct from old.payout_account_name or new.payout_account_number is distinct from old.payout_account_number then new.payout_destination_updated_at=now(); end if; return new; end $$;
drop trigger if exists trg_track_payout_destination_change on public.profiles;
create trigger trg_track_payout_destination_change before update on public.profiles for each row execute function public.track_payout_destination_change();

-- Admin invitations create Merchants safely in pending verification instead of bypassing permit/payment review.
create or replace function public.activate_account_invitation()
returns trigger language plpgsql security definer set search_path=public,auth as $$
declare v_inv public.account_invitations; v_email text;
begin
  select lower(email) into v_email from auth.users where id=new.id; select * into v_inv from public.account_invitations where email=v_email and status='pending' limit 1;
  if v_inv.id is null then return new; end if;
  update public.profiles set full_name=v_inv.full_name,phone=v_inv.phone,role=v_inv.role,account_status=case when v_inv.role='merchant' then 'pending' else 'approved' end,onboarding_completed=true where id=new.id;
  if v_inv.role='merchant' then insert into public.merchant_profiles(id,business_name,status,subscription_active) values(new.id,coalesce(nullif(trim(v_inv.business_name),''),v_inv.full_name),'pending',false) on conflict(id) do update set business_name=excluded.business_name,status='pending',subscription_active=false; end if;
  insert into public.wallets(owner_id,balance) values(new.id,0) on conflict(owner_id) do nothing;
  if v_inv.role='reseller' then insert into public.subscriptions(owner_id,status,is_free,started_at,expires_at) values(new.id,'active',true,now(),now()+interval '1 year') on conflict(owner_id) do nothing; end if;
  update public.account_invitations set status='accepted',accepted_at=now() where id=v_inv.id; return new;
end $$;
create or replace function public.activate_existing_account_invitation()
returns trigger language plpgsql security definer set search_path=public,auth as $$
declare v_user_id uuid;
begin
  if new.status<>'pending' then return new; end if; select id into v_user_id from auth.users where lower(email)=new.email limit 1; if v_user_id is null then return new; end if;
  update public.profiles set full_name=new.full_name,phone=new.phone,role=new.role,account_status=case when new.role='merchant' then 'pending' else 'approved' end,onboarding_completed=true where id=v_user_id;
  if new.role='merchant' then insert into public.merchant_profiles(id,business_name,status,subscription_active) values(v_user_id,coalesce(nullif(trim(new.business_name),''),new.full_name),'pending',false) on conflict(id) do update set business_name=excluded.business_name,status='pending',subscription_active=false; end if;
  insert into public.wallets(owner_id,balance) values(v_user_id,0) on conflict(owner_id) do nothing;
  if new.role='reseller' then insert into public.subscriptions(owner_id,status,is_free,started_at,expires_at) values(v_user_id,'active',true,now(),now()+interval '1 year') on conflict(owner_id) do nothing; end if;
  update public.account_invitations set status='accepted',accepted_at=now() where id=new.id; return new;
end $$;

create or replace function public.mark_withdrawal_sent_with_proof(p_request_id uuid,p_transfer_reference text,p_proof_url text)
returns public.withdrawal_requests language plpgsql security definer set search_path=public as $$
declare result public.withdrawal_requests;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if char_length(trim(coalesce(p_transfer_reference,'')))<4 or nullif(trim(p_proof_url),'') is null then raise exception 'TRANSFER_REFERENCE_AND_PROOF_REQUIRED'; end if;
  update public.withdrawal_requests set sent_at=now(),sent_by=auth.uid(),transfer_reference=left(trim(p_transfer_reference),120),transfer_proof_url=p_proof_url
  where id=p_request_id and status='approved' and sent_at is null returning * into result;
  if result.id is null then raise exception 'WITHDRAWAL_NOT_APPROVED_OR_ALREADY_SENT'; end if; return result;
end $$;

create or replace function public.get_merchant_approval_queue()
returns table(id uuid,full_name text,email text,business_name text,permit_status text,merchant_status text,subscription_request_id uuid,subscription_status text,plan_months integer,amount numeric,account_status text)
language plpgsql stable security definer set search_path=public as $$ begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  return query select p.id,p.full_name,p.email,mp.business_name,mp.business_permit_status,mp.status,sr.id,sr.status::text,sr.plan_months,sr.amount,p.account_status::text
  from public.profiles p join public.merchant_profiles mp on mp.id=p.id
  left join lateral(select * from public.subscription_requests r where r.owner_id=p.id order by r.created_at desc limit 1) sr on true
  where p.role='merchant' order by p.created_at desc; end
$$;
create or replace function public.activate_merchant_application(p_merchant_id uuid,p_subscription_request_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if not exists(select 1 from public.merchant_profiles where id=p_merchant_id and business_permit_status='approved') then raise exception 'PERMIT_APPROVAL_REQUIRED'; end if;
  if not exists(select 1 from public.subscription_requests where id=p_subscription_request_id and owner_id=p_merchant_id and status='pending') then raise exception 'PENDING_SUBSCRIPTION_REQUIRED'; end if;
  update public.subscription_requests set status='approved',reviewed_by=auth.uid(),reviewed_at=now() where id=p_subscription_request_id;
end $$;

grant execute on function public.open_order_case(uuid,text,text,text),public.review_order_case(uuid,boolean,text),public.set_order_delivery(uuid,text,text,timestamptz,timestamptz,text,numeric),public.record_customer_payment(uuid,numeric,numeric,text,text,text) to authenticated;
grant execute on function public.get_merchant_approval_queue(),public.activate_merchant_application(uuid,uuid) to authenticated;
grant execute on function public.mark_withdrawal_sent_with_proof(uuid,text,text) to authenticated;
revoke all on function public.complete_due_deliveries() from public,anon;
grant execute on function public.complete_due_deliveries() to authenticated;
grant execute on function public.run_operational_maintenance() to authenticated;
notify pgrst,'reload schema';
