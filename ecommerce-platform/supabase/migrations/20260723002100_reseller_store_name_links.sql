-- Human-readable, unique Reseller storefront links.
alter table public.profiles add column if not exists storefront_name text;
alter table public.profiles add column if not exists storefront_slug text;
create unique index if not exists profiles_storefront_slug_unique
on public.profiles(storefront_slug) where storefront_slug is not null;

create or replace function public.set_reseller_storefront_slug()
returns trigger language plpgsql security definer set search_path=public as $$
declare base_slug text; candidate text;
begin
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

drop trigger if exists set_reseller_storefront_slug on public.profiles;
create trigger set_reseller_storefront_slug
before insert or update of storefront_name,role on public.profiles
for each row execute function public.set_reseller_storefront_slug();

update public.profiles
set storefront_name=coalesce(nullif(trim(storefront_name),''),full_name || ' Store')
where role='reseller' and storefront_slug is null;

drop function if exists public.get_reseller_storefront_by_slug(text);
create function public.get_reseller_storefront_by_slug(p_slug text)
returns table(id uuid,full_name text,storefront_name text,storefront_slug text,avatar_url text,cover_url text,reseller_bio text)
language sql stable security definer set search_path=public as $$
  select p.id,p.full_name,p.storefront_name,p.storefront_slug,p.avatar_url,p.cover_url,p.reseller_bio
  from public.profiles p
  where p.storefront_slug=lower(trim(p_slug))
    and p.role='reseller'
    and p.account_status='approved'
$$;

revoke all on function public.get_reseller_storefront_by_slug(text) from public;
grant execute on function public.get_reseller_storefront_by_slug(text) to anon,authenticated;

notify pgrst,'reload schema';
