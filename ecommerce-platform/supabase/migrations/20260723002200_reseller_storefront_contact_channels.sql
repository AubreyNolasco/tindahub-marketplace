-- Optional public contact channels chosen by each Reseller.
alter table public.profiles add column if not exists storefront_facebook_url text;
alter table public.profiles add column if not exists storefront_contact_number text;
alter table public.profiles add column if not exists storefront_viber_number text;
alter table public.profiles add column if not exists storefront_whatsapp_number text;

drop function if exists public.get_reseller_storefront_by_slug(text);
create function public.get_reseller_storefront_by_slug(p_slug text)
returns table(
  id uuid,full_name text,storefront_name text,storefront_slug text,
  avatar_url text,cover_url text,reseller_bio text,
  storefront_facebook_url text,storefront_contact_number text,
  storefront_viber_number text,storefront_whatsapp_number text
)
language sql stable security definer set search_path=public as $$
  select p.id,p.full_name,p.storefront_name,p.storefront_slug,
    p.avatar_url,p.cover_url,p.reseller_bio,
    p.storefront_facebook_url,p.storefront_contact_number,
    p.storefront_viber_number,p.storefront_whatsapp_number
  from public.profiles p
  where p.storefront_slug=lower(trim(p_slug))
    and p.role='reseller'
    and p.account_status='approved'
$$;

revoke all on function public.get_reseller_storefront_by_slug(text) from public;
grant execute on function public.get_reseller_storefront_by_slug(text) to anon,authenticated;

notify pgrst,'reload schema';
