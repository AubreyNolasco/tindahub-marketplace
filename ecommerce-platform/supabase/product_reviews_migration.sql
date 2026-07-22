-- Verified reseller product reviews and ratings.
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  reseller_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  reviewer_name text not null default 'Verified Reseller',
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (char_length(trim(comment)) between 3 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, reseller_id)
);

create index if not exists idx_product_reviews_product on public.product_reviews(product_id, created_at desc);
create index if not exists idx_product_reviews_reseller on public.product_reviews(reseller_id);

create or replace function public.prepare_product_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.reseller_id := auth.uid();
  select coalesce(nullif(trim(full_name), ''), 'Verified Reseller') into new.reviewer_name
  from public.profiles where id = auth.uid() and role = 'reseller';
  if new.reviewer_name is null then raise exception 'RESELLER_ONLY'; end if;
  new.comment := trim(new.comment);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_prepare_product_review on public.product_reviews;
create trigger trg_prepare_product_review before insert or update on public.product_reviews
for each row execute function public.prepare_product_review();

alter table public.product_reviews enable row level security;
drop policy if exists "product_reviews_public_read" on public.product_reviews;
create policy "product_reviews_public_read" on public.product_reviews for select using (true);
drop policy if exists "product_reviews_verified_insert" on public.product_reviews;
create policy "product_reviews_verified_insert" on public.product_reviews for insert to authenticated
with check (
  reseller_id = auth.uid() and exists (
    select 1 from public.orders o join public.order_items oi on oi.order_id = o.id
    where o.id = order_id and o.reseller_id = auth.uid() and o.status = 'completed'
      and oi.product_id = product_id
  )
);
drop policy if exists "product_reviews_owner_update" on public.product_reviews;
create policy "product_reviews_owner_update" on public.product_reviews for update to authenticated
using (reseller_id = auth.uid()) with check (reseller_id = auth.uid());
drop policy if exists "product_reviews_owner_or_admin_delete" on public.product_reviews;
create policy "product_reviews_owner_or_admin_delete" on public.product_reviews for delete to authenticated
using (reseller_id = auth.uid() or public.is_admin());

grant select on public.product_reviews to anon, authenticated;
grant insert, update, delete on public.product_reviews to authenticated;
