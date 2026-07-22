-- =====================================================================
-- Fix: "function uuid_generate_v4() does not exist" on place_order (and
-- any other insert that relies on a default id).
--
-- Cause: this project's tables were originally provisioned with
-- id uuid primary key default uuid_generate_v4() (Supabase's old default
-- template, via the uuid-ossp extension). schema.sql was later rewritten
-- to use the built-in gen_random_uuid() instead (no extension required),
-- but `create table if not exists` never touches a table that already
-- exists, so the live column defaults were never updated to match.
--
-- Fix: point every id column's default at gen_random_uuid() directly.
-- Run this ONCE in Supabase Dashboard > SQL Editor.
-- =====================================================================

alter table public.profiles              alter column id set default gen_random_uuid();
alter table public.merchant_profiles      alter column id set default gen_random_uuid();
alter table public.wallets                alter column id set default gen_random_uuid();
alter table public.wallet_transactions    alter column id set default gen_random_uuid();
alter table public.topup_requests         alter column id set default gen_random_uuid();
alter table public.withdrawal_requests    alter column id set default gen_random_uuid();
alter table public.categories             alter column id set default gen_random_uuid();
alter table public.products               alter column id set default gen_random_uuid();
alter table public.customers              alter column id set default gen_random_uuid();
alter table public.orders                 alter column id set default gen_random_uuid();
alter table public.order_items            alter column id set default gen_random_uuid();
alter table public.payments               alter column id set default gen_random_uuid();
alter table public.chat_messages          alter column id set default gen_random_uuid();

-- Sanity check: confirm nothing still points at uuid_generate_v4().
select table_name, column_name, column_default
from information_schema.columns
where table_schema = 'public'
  and column_default ilike '%uuid_generate_v4%';
-- ^ should return 0 rows after running the ALTERs above.
