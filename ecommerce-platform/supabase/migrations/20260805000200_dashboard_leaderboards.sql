-- =====================================================================
-- JOM HUB Marketplace — Admin Dashboard Leaderboards
-- Optimized aggregate RPCs for the dashboard "Top performers" cards.
-- All computation happens in the database (SUM/COUNT/GROUP BY) so the
-- frontend never pulls full records. Each endpoint returns a single
-- ranked row via ORDER BY ... LIMIT 1.
--
-- Each function accepts an optional date range (p_start_date / p_end_date)
-- so the dashboard can rank by a selected period. When either is NULL the
-- filter is ignored (all-time ranking).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Top Product: product with the most total quantity sold.
-- Revenue is the sum of line totals over non-cancelled orders.
--
-- Drop any legacy zero-argument overloads first so PostgREST never has
-- to guess between get_top_product() and get_top_product(date, date).
-- ---------------------------------------------------------------------
drop function if exists public.get_top_product();
drop function if exists public.get_top_product(date, date);

create or replace function public.get_top_product(p_start_date date default null, p_end_date date default null)
returns table (
  product_id uuid,
  product_name text,
  image_url text,
  total_sold bigint,
  total_revenue numeric,
  rank bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    oi.product_id,
    oi.product_name,
    (select p.images[1] from public.products p where p.id = oi.product_id) as image_url,
    sum(oi.quantity) as total_sold,
    sum(oi.line_total) as total_revenue,
    1::bigint as rank
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.status <> 'cancelled'
    and oi.product_id is not null
    and (p_start_date is null or o.created_at >= p_start_date::timestamptz)
    and (p_end_date is null or o.created_at < (p_end_date + 1)::timestamptz)
  group by oi.product_id, oi.product_name
  order by total_sold desc, total_revenue desc
  limit 1
$$;

-- ---------------------------------------------------------------------
-- Top Reseller: reseller with the highest total sales (non-cancelled).
-- Includes the number of orders and profile photo when available.
--
-- Drop any legacy zero-argument overloads first to avoid PostgREST
-- ambiguity between get_top_reseller() and get_top_reseller(date, date).
-- ---------------------------------------------------------------------
drop function if exists public.get_top_reseller();
drop function if exists public.get_top_reseller(date, date);

create or replace function public.get_top_reseller(p_start_date date default null, p_end_date date default null)
returns table (
  reseller_id uuid,
  reseller_name text,
  avatar_url text,
  total_sales numeric,
  total_orders bigint,
  rank bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    o.reseller_id,
    pr.full_name,
    pr.avatar_url,
    sum(o.total) as total_sales,
    count(o.id) as total_orders,
    1::bigint as rank
  from public.orders o
  join public.profiles pr on pr.id = o.reseller_id
  where o.status <> 'cancelled'
    and (p_start_date is null or o.created_at >= p_start_date::timestamptz)
    and (p_end_date is null or o.created_at < (p_end_date + 1)::timestamptz)
  group by o.reseller_id, pr.full_name, pr.avatar_url
  order by total_sales desc, total_orders desc
  limit 1
$$;

-- ---------------------------------------------------------------------
-- Top Merchant: merchant with the highest total sales (non-cancelled).
-- Includes the number of orders and logo/profile when available.
--
-- Drop any legacy zero-argument overloads first to avoid PostgREST
-- ambiguity between get_top_merchant() and get_top_merchant(date, date).
-- ---------------------------------------------------------------------
drop function if exists public.get_top_merchant();
drop function if exists public.get_top_merchant(date, date);

create or replace function public.get_top_merchant(p_start_date date default null, p_end_date date default null)
returns table (
  merchant_id uuid,
  merchant_name text,
  logo_url text,
  total_sales numeric,
  total_orders bigint,
  rank bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    o.merchant_id,
    mp.business_name,
    pr.avatar_url as logo_url,
    sum(o.total) as total_sales,
    count(o.id) as total_orders,
    1::bigint as rank
  from public.orders o
  join public.merchant_profiles mp on mp.id = o.merchant_id
  join public.profiles pr on pr.id = o.merchant_id
  where o.status <> 'cancelled'
    and (p_start_date is null or o.created_at >= p_start_date::timestamptz)
    and (p_end_date is null or o.created_at < (p_end_date + 1)::timestamptz)
  group by o.merchant_id, mp.business_name, pr.avatar_url
  order by total_sales desc, total_orders desc
  limit 1
$$;

-- Only authenticated users (admins) may call these.
revoke all on function public.get_top_product(date, date) from public, anon;
revoke all on function public.get_top_reseller(date, date) from public, anon;
revoke all on function public.get_top_merchant(date, date) from public, anon;
grant execute on function public.get_top_product(date, date) to authenticated;
grant execute on function public.get_top_reseller(date, date) to authenticated;
grant execute on function public.get_top_merchant(date, date) to authenticated;

-- Reload the schema cache so the new functions are immediately callable.
notify pgrst, 'reload schema';
