-- Saved payout destinations, traceable withdrawal delivery, and optional
-- Merchant store hours. Existing accounts and products remain unchanged.
alter table public.profiles add column if not exists payout_method text;
alter table public.profiles add column if not exists payout_provider text;
alter table public.profiles add column if not exists payout_account_name text;
alter table public.profiles add column if not exists payout_account_number text;

alter table public.withdrawal_requests add column if not exists scheduled_for timestamptz;
alter table public.withdrawal_requests add column if not exists sent_at timestamptz;
alter table public.withdrawal_requests add column if not exists transfer_reference text;
alter table public.withdrawal_requests add column if not exists sent_by uuid references public.profiles(id);

alter table public.merchant_profiles add column if not exists store_open_time time;
alter table public.merchant_profiles add column if not exists store_close_time time;
alter table public.merchant_profiles add column if not exists auto_pause_outside_hours boolean not null default false;
alter table public.merchant_profiles add column if not exists store_timezone text not null default 'Asia/Manila';

create or replace function public.is_merchant_store_open(p_merchant_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $$
declare m public.merchant_profiles; local_time time;
begin
  select * into m from public.merchant_profiles where id=p_merchant_id;
  if m.id is null then return false; end if;
  if not m.auto_pause_outside_hours or m.store_open_time is null or m.store_close_time is null then return true; end if;
  local_time := (now() at time zone coalesce(nullif(m.store_timezone,''),'Asia/Manila'))::time;
  if m.store_open_time = m.store_close_time then return true; end if;
  if m.store_open_time < m.store_close_time then return local_time >= m.store_open_time and local_time < m.store_close_time; end if;
  return local_time >= m.store_open_time or local_time < m.store_close_time;
end $$;
grant execute on function public.is_merchant_store_open(uuid) to anon,authenticated;

create or replace function public.block_closed_store_order()
returns trigger language plpgsql set search_path=public as $$
begin
  if not public.is_merchant_store_open(new.merchant_id) then raise exception 'STORE_CLOSED'; end if;
  return new;
end $$;
drop trigger if exists trg_block_closed_store_order on public.orders;
create trigger trg_block_closed_store_order before insert on public.orders for each row execute function public.block_closed_store_order();

create or replace function public.mark_withdrawal_sent(p_request_id uuid,p_transfer_reference text)
returns public.withdrawal_requests
language plpgsql security definer set search_path=public as $$
declare result public.withdrawal_requests;
begin
  if not public.has_admin_permission('withdrawals') then raise exception 'ADMIN_REQUIRED'; end if;
  if nullif(trim(p_transfer_reference),'') is null then raise exception 'TRANSFER_REFERENCE_REQUIRED'; end if;
  update public.withdrawal_requests
  set sent_at=now(),sent_by=auth.uid(),transfer_reference=left(trim(p_transfer_reference),120)
  where id=p_request_id and status='approved' and sent_at is null
  returning * into result;
  if result.id is null then raise exception 'WITHDRAWAL_NOT_APPROVED_OR_ALREADY_SENT'; end if;
  return result;
end $$;
grant execute on function public.mark_withdrawal_sent(uuid,text) to authenticated;

notify pgrst, 'reload schema';
