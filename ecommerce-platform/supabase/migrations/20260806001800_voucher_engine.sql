-- Phase 10 of TASK6.md: Voucher Engine. Net-new module -- grepping
-- voucher|promo_code|discount_code across src/ during Phase 1 found zero
-- matches, so this is genuinely additive, not an improvement of
-- something that already existed.
--
-- Follows the same conventions as the rest of this app: enum status,
-- security-definer RPCs as the only write/validate path, RLS scoping
-- ownership to the creator (admin for platform-wide, a merchant for
-- their own merchant/product/category vouchers), and the exact
-- "server recomputes everything, client estimate is never trusted"
-- pattern already used by place_order()/quote_order() for pricing.

create type public.voucher_scope as enum ('platform', 'merchant', 'product', 'category', 'shipping');
create type public.voucher_discount_type as enum ('percent', 'fixed');

create table public.vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  scope public.voucher_scope not null,
  discount_type public.voucher_discount_type not null,
  discount_value numeric(12,2) not null check (discount_value > 0),
  max_discount_amount numeric(12,2) check (max_discount_amount is null or max_discount_amount > 0),
  min_spend numeric(12,2) not null default 0 check (min_spend >= 0),
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  usage_limit_per_user integer not null default 1 check (usage_limit_per_user > 0),
  merchant_id uuid references public.merchant_profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (scope <> 'merchant' or merchant_id is not null),
  check (scope <> 'product' or (merchant_id is not null and product_id is not null)),
  check (scope <> 'category' or (merchant_id is not null and category_id is not null)),
  check (discount_type <> 'percent' or discount_value <= 100)
);
create unique index vouchers_code_unique on public.vouchers(upper(code));
create index idx_vouchers_active_window on public.vouchers(is_active, starts_at, ends_at);
create index idx_vouchers_merchant on public.vouchers(merchant_id) where merchant_id is not null;

create table public.voucher_redemptions (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.vouchers(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  order_id uuid references public.orders(id),
  discount_amount numeric(12,2) not null,
  redeemed_at timestamptz not null default now()
);
create index idx_voucher_redemptions_voucher on public.voucher_redemptions(voucher_id);
create index idx_voucher_redemptions_user on public.voucher_redemptions(user_id);

alter table public.vouchers enable row level security;
alter table public.voucher_redemptions enable row level security;

create policy "vouchers_owner_manage" on public.vouchers
  for all to authenticated using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

create policy "voucher_redemptions_read_own" on public.voucher_redemptions
  for select to authenticated using (
    user_id = auth.uid() or public.is_admin() or
    exists (select 1 from public.vouchers v where v.id = voucher_id and v.created_by = auth.uid())
  );

revoke all on public.vouchers, public.voucher_redemptions from anon, authenticated;
grant select, insert, update, delete on public.vouchers to authenticated;
grant select on public.voucher_redemptions to authenticated;

-- ---------------------------------------------------------------------
-- resolve_voucher -- the single source of truth for "is this code
-- usable right now, for this buyer/merchant/cart, and what does it
-- discount". Called by both quote_order() (preview) and place_order()
-- (authoritative, re-validated at the moment of purchase so a code that
-- expired or hit its usage limit between quote and place is caught).
-- ---------------------------------------------------------------------
create or replace function public.resolve_voucher(
  p_code text, p_buyer uuid, p_merchant_id uuid, p_items jsonb, p_subtotal numeric, p_shipping_fee numeric
)
returns table(valid boolean, error text, discount_amount numeric, applies_to text, voucher_id uuid)
language plpgsql stable security definer set search_path = public as $$
declare
  v public.vouchers;
  v_eligible boolean;
  v_amount numeric(12,2);
  v_total_used integer;
  v_user_used integer;
begin
  select * into v from public.vouchers where upper(code) = upper(trim(p_code));
  if v.id is null then return query select false, 'VOUCHER_NOT_FOUND', 0::numeric, null::text, null::uuid; return; end if;
  if not v.is_active or now() < v.starts_at or now() > v.ends_at then
    return query select false, 'VOUCHER_EXPIRED', 0::numeric, null::text, v.id; return;
  end if;

  v_eligible := case v.scope
    when 'platform' then true
    when 'merchant' then v.merchant_id = p_merchant_id
    when 'shipping' then v.merchant_id is null or v.merchant_id = p_merchant_id
    when 'product' then v.merchant_id = p_merchant_id and exists (select 1 from jsonb_array_elements(p_items) item where (item->>'product_id')::uuid = v.product_id)
    when 'category' then v.merchant_id = p_merchant_id and exists (
      select 1 from jsonb_array_elements(p_items) item
      join public.products p on p.id = (item->>'product_id')::uuid
      where p.category_id = v.category_id
    )
    else false
  end;
  if not v_eligible then return query select false, 'VOUCHER_NOT_ELIGIBLE', 0::numeric, null::text, v.id; return; end if;

  if p_subtotal < v.min_spend then return query select false, 'VOUCHER_MIN_SPEND_NOT_MET', 0::numeric, null::text, v.id; return; end if;

  if v.usage_limit is not null then
    select count(*) into v_total_used from public.voucher_redemptions where voucher_id = v.id;
    if v_total_used >= v.usage_limit then return query select false, 'VOUCHER_USAGE_LIMIT_REACHED', 0::numeric, null::text, v.id; return; end if;
  end if;

  select count(*) into v_user_used from public.voucher_redemptions where voucher_id = v.id and user_id = p_buyer;
  if v_user_used >= v.usage_limit_per_user then return query select false, 'VOUCHER_ALREADY_USED', 0::numeric, null::text, v.id; return; end if;

  if v.scope = 'shipping' then
    v_amount := case v.discount_type when 'percent' then round(p_shipping_fee * v.discount_value / 100, 2) else v.discount_value end;
    v_amount := least(v_amount, p_shipping_fee);
    if v.max_discount_amount is not null then v_amount := least(v_amount, v.max_discount_amount); end if;
    return query select true, null::text, v_amount, 'shipping'::text, v.id;
  else
    v_amount := case v.discount_type when 'percent' then round(p_subtotal * v.discount_value / 100, 2) else v.discount_value end;
    v_amount := least(v_amount, p_subtotal);
    if v.max_discount_amount is not null then v_amount := least(v_amount, v.max_discount_amount); end if;
    return query select true, null::text, v_amount, 'subtotal'::text, v.id;
  end if;
end;
$$;
revoke all on function public.resolve_voucher(text, uuid, uuid, jsonb, numeric, numeric) from public, anon;
grant execute on function public.resolve_voucher(text, uuid, uuid, jsonb, numeric, numeric) to authenticated;

-- Preview-only wrapper for the checkout UI -- same validation as
-- resolve_voucher, using the calling user's own auth.uid(), no
-- redemption side effect either way.
create or replace function public.validate_voucher(p_code text, p_merchant_id uuid, p_items jsonb, p_subtotal numeric, p_shipping_fee numeric default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r record;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into r from public.resolve_voucher(p_code, auth.uid(), p_merchant_id, p_items, p_subtotal, p_shipping_fee);
  return jsonb_build_object('valid', r.valid, 'error', r.error, 'discount_amount', r.discount_amount, 'applies_to', r.applies_to);
end;
$$;
revoke all on function public.validate_voucher(text, uuid, jsonb, numeric, numeric) from public, anon;
grant execute on function public.validate_voucher(text, uuid, jsonb, numeric, numeric) to authenticated;

notify pgrst, 'reload schema';
