-- =====================================================================
-- Fix: Reseller storefront links falling back to a raw UUID
--
-- set_reseller_storefront_slug() (20260723002100_reseller_store_name_links.sql)
-- only generates storefront_slug when storefront_name is already set. A
-- one-time backfill at that migration covered resellers that existed as
-- of 2026-07-23; any reseller who signed up after, and never opened
-- "My Product List" to save a store name, still has both columns null --
-- so their share link (StorefrontProducts.jsx) falls back to the raw
-- /reseller-store/:id route instead of a readable /store/:slug one.
--
-- 1. Re-run the backfill for any reseller currently missing a slug.
-- 2. Make it self-healing going forward: default storefront_name on
--    INSERT so a slug always exists from the moment a reseller profile
--    is created, without waiting for a manual save.
-- =====================================================================

update public.profiles
set storefront_name = coalesce(nullif(trim(storefront_name), ''), full_name || ' Store')
where role = 'reseller' and storefront_slug is null;

create or replace function public.set_reseller_storefront_slug()
returns trigger language plpgsql security definer set search_path = public as $$
declare base_slug text; candidate text;
begin
  if new.role = 'reseller' and tg_op = 'INSERT' and nullif(trim(coalesce(new.storefront_name, '')), '') is null then
    new.storefront_name := coalesce(nullif(trim(new.full_name), ''), 'My') || ' Store';
  end if;

  if new.role <> 'reseller' or nullif(trim(new.storefront_name),'') is null then
    new.storefront_slug := null;
    return new;
  end if;
  new.storefront_name := left(trim(new.storefront_name),100);
  if new.storefront_slug is not null
    and tg_op='UPDATE'
    and new.storefront_name is not distinct from old.storefront_name then
    return new;
  end if;
  base_slug := trim(both '-' from lower(regexp_replace(new.storefront_name,'[^a-zA-Z0-9]+','-','g')));
  if char_length(base_slug)<2 then base_slug := 'reseller-store'; end if;
  base_slug := left(base_slug,80);
  candidate := base_slug;
  if exists(select 1 from public.profiles p where p.storefront_slug=candidate and p.id<>new.id) then
    candidate := left(base_slug,72) || '-' || left(new.id::text,6);
  end if;
  new.storefront_slug := candidate;
  return new;
end $$;

-- Trigger definition itself is unchanged (same function slot, same
-- firing conditions) -- re-asserted for clarity, matching this repo's
-- convention when a trigger function is replaced.
drop trigger if exists set_reseller_storefront_slug on public.profiles;
create trigger set_reseller_storefront_slug
before insert or update of storefront_name, role on public.profiles
for each row execute function public.set_reseller_storefront_slug();

notify pgrst, 'reload schema';
