-- =====================================================================
-- get_product_sold_counts — aggregate-only public read for a Shopee/
-- Lazada-style "X sold" badge on the product catalog grid.
--
-- order_items is participant-scoped RLS (order owner/merchant/staff
-- only) — a direct client aggregate query would return nothing for a
-- shopper who isn't a party to any of those orders. This RPC exposes
-- only a per-product completed-order unit count, never any order,
-- customer, or pricing detail, so it's safe to expose to any caller
-- (same "public-safe aggregate" posture as product_reviews' own
-- `for select using (true)` policy already has).
-- =====================================================================

create or replace function public.get_product_sold_counts(p_product_ids uuid[])
returns table (product_id uuid, sold_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select oi.product_id, sum(oi.quantity)::bigint as sold_count
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.status = 'completed' and oi.product_id = any(p_product_ids)
  group by oi.product_id;
$$;

revoke all on function public.get_product_sold_counts(uuid[]) from public;
grant execute on function public.get_product_sold_counts(uuid[]) to anon, authenticated;

notify pgrst, 'reload schema';
