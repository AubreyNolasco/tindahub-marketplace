-- =====================================================================
-- Fix get_reseller_storefront(uuid) missing storefront_name and
-- contact-channel columns that get_reseller_storefront_by_slug already
-- has. Resellers without a custom storefront_slug are linked via
-- /reseller-store/:id, which calls this id-based RPC — it was never
-- updated when storefront_name (20260723002100) and the contact-channel
-- fields (20260723002200) were added to the slug-based RPC.
-- =====================================================================

drop function if exists public.get_reseller_storefront(uuid);

create function public.get_reseller_storefront(p_reseller_id uuid)
returns table(
  id uuid, full_name text, storefront_name text,
  avatar_url text, cover_url text, reseller_bio text,
  storefront_facebook_url text, storefront_contact_number text,
  storefront_viber_number text, storefront_whatsapp_number text
)
language sql stable security definer set search_path = public
as $$
  select p.id, p.full_name, p.storefront_name,
    p.avatar_url, p.cover_url, p.reseller_bio,
    p.storefront_facebook_url, p.storefront_contact_number,
    p.storefront_viber_number, p.storefront_whatsapp_number
  from public.profiles p
  where p.id = p_reseller_id and p.role = 'reseller' and p.account_status = 'approved'
$$;

revoke all on function public.get_reseller_storefront(uuid) from public;
grant execute on function public.get_reseller_storefront(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
