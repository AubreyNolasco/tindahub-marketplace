-- Allow full administrators to create and remove products on behalf of an
-- approved Merchant. Updates were already admin-enabled by security hardening.
drop policy if exists "products_admin_insert" on public.products;
create policy "products_admin_insert" on public.products for insert to authenticated
with check (
  public.is_admin() and exists (
    select 1 from public.merchant_profiles merchant
    where merchant.id = products.merchant_id and merchant.status = 'approved'
  )
);

drop policy if exists "products_admin_delete" on public.products;
create policy "products_admin_delete" on public.products for delete to authenticated
using (public.is_admin());

-- Admin image uploads use an admin-owned storage path while the resulting
-- public URL is attached to the selected Merchant's product.
drop policy if exists "product_images_admin_insert" on storage.objects;
create policy "product_images_admin_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'product-images' and public.is_admin());
drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update" on storage.objects for update to authenticated
using (bucket_id = 'product-images' and public.is_admin())
with check (bucket_id = 'product-images' and public.is_admin());
