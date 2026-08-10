-- =====================================================================
-- admin_seed_sample_catalog() (20260808000400_admin_sample_catalog.sql)
-- plants real 'completed' rows into public.orders (notes =
-- 'SAMPLE_CATALOG_SEED') purely so sample products show a sold count in
-- the public catalog. Nothing downstream ever excluded them, so every
-- admin-facing revenue figure that reads public.orders directly --
-- Admin Overview's "Gross marketplace value", the Sales Dashboard, and
-- these leaderboard RPCs -- currently counts fake sample revenue as if
-- it were real. This migration only fixes the leaderboard RPCs; the two
-- client-side queries (AdminDashboard.jsx, Sales.jsx) were fixed
-- separately in the same change.
--
-- `o.notes is distinct from 'SAMPLE_CATALOG_SEED'` rather than
-- `o.notes <> 'SAMPLE_CATALOG_SEED'` deliberately -- SQL's `<>` against
-- a NULL notes value (the normal case for a real order) evaluates to
-- NULL, not true, which would silently drop every real order that has
-- no notes at all. IS DISTINCT FROM treats NULL as not equal to the
-- marker, which is what's actually wanted here.
-- =====================================================================

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
    and o.notes is distinct from 'SAMPLE_CATALOG_SEED'
    and oi.product_id is not null
    and (p_start_date is null or o.created_at >= p_start_date::timestamptz)
    and (p_end_date is null or o.created_at < (p_end_date + 1)::timestamptz)
  group by oi.product_id, oi.product_name
  order by total_sold desc, total_revenue desc
  limit 1
$$;

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
    and o.notes is distinct from 'SAMPLE_CATALOG_SEED'
    and (p_start_date is null or o.created_at >= p_start_date::timestamptz)
    and (p_end_date is null or o.created_at < (p_end_date + 1)::timestamptz)
  group by o.reseller_id, pr.full_name, pr.avatar_url
  order by total_sales desc, total_orders desc
  limit 1
$$;

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
    and o.notes is distinct from 'SAMPLE_CATALOG_SEED'
    and (p_start_date is null or o.created_at >= p_start_date::timestamptz)
    and (p_end_date is null or o.created_at < (p_end_date + 1)::timestamptz)
  group by o.merchant_id, mp.business_name, pr.avatar_url
  order by total_sales desc, total_orders desc
  limit 1
$$;

notify pgrst, 'reload schema';
