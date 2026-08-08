-- Two-level category tree (parent -> child), matching the reference
-- mockup's expandable category filter. Depth is intentionally capped at
-- one level (not arbitrary nesting) -- kept simple, and enforced below
-- so a subcategory can never itself become a parent.
alter table public.categories
  add column if not exists parent_id uuid references public.categories(id) on delete set null;

create index if not exists categories_parent_id_idx on public.categories(parent_id);

create or replace function public.enforce_category_tree_depth()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is not null and exists (
    select 1 from public.categories where id = new.parent_id and parent_id is not null
  ) then
    raise exception 'Categories can only be nested one level deep.';
  end if;
  if new.parent_id is not null and exists (
    select 1 from public.categories where parent_id = new.id
  ) then
    raise exception 'A category with subcategories cannot become a subcategory itself.';
  end if;
  if new.parent_id = new.id then
    raise exception 'A category cannot be its own parent.';
  end if;
  return new;
end;
$$;

drop trigger if exists category_tree_depth_check on public.categories;
create trigger category_tree_depth_check
  before insert or update of parent_id on public.categories
  for each row execute function public.enforce_category_tree_depth();
