-- Curated customer-facing storefronts for approved Resellers.
alter table public.profiles add column if not exists cover_url text;
alter table public.profiles add column if not exists reseller_bio text;

create table if not exists public.reseller_storefront_products (
  reseller_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reseller_id, product_id)
);

alter table public.reseller_storefront_products enable row level security;

drop policy if exists reseller_storefront_products_public_read on public.reseller_storefront_products;
create policy reseller_storefront_products_public_read
on public.reseller_storefront_products for select
using (true);

drop policy if exists reseller_storefront_products_owner_insert on public.reseller_storefront_products;
create policy reseller_storefront_products_owner_insert
on public.reseller_storefront_products for insert to authenticated
with check (
  reseller_id=auth.uid()
  and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='reseller' and p.account_status='approved')
  and exists(select 1 from public.products product where product.id=product_id and product.is_active)
);

drop policy if exists reseller_storefront_products_owner_delete on public.reseller_storefront_products;
create policy reseller_storefront_products_owner_delete
on public.reseller_storefront_products for delete to authenticated
using (reseller_id=auth.uid() or public.is_admin());

grant select,insert,delete on public.reseller_storefront_products to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('reseller-storefronts','reseller-storefronts',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update
set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists reseller_storefront_media_public_read on storage.objects;
create policy reseller_storefront_media_public_read
on storage.objects for select
using(bucket_id='reseller-storefronts');

drop policy if exists reseller_storefront_media_owner_insert on storage.objects;
create policy reseller_storefront_media_owner_insert
on storage.objects for insert to authenticated
with check(bucket_id='reseller-storefronts' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists reseller_storefront_media_owner_update on storage.objects;
create policy reseller_storefront_media_owner_update
on storage.objects for update to authenticated
using(bucket_id='reseller-storefronts' and (storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='reseller-storefronts' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists reseller_storefront_media_owner_delete on storage.objects;
create policy reseller_storefront_media_owner_delete
on storage.objects for delete to authenticated
using(bucket_id='reseller-storefronts' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));

create or replace function public.get_reseller_storefront(p_reseller_id uuid)
returns table(id uuid,full_name text,avatar_url text,cover_url text,reseller_bio text)
language sql stable security definer set search_path=public
as $$
  select p.id,p.full_name,p.avatar_url,p.cover_url,p.reseller_bio
  from public.profiles p
  where p.id=p_reseller_id and p.role='reseller' and p.account_status='approved'
$$;

revoke all on function public.get_reseller_storefront(uuid) from public;
grant execute on function public.get_reseller_storefront(uuid) to anon,authenticated;

notify pgrst,'reload schema';
