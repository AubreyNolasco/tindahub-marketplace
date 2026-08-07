-- Phase 10 (cont.): close a security gap found while building the
-- voucher management UI. 20260806001800_voucher_engine.sql granted
-- insert/update/delete on public.vouchers directly to `authenticated`,
-- with RLS only checking `created_by = auth.uid() or is_admin()` -- that
-- check never looks at *role* or *scope*, so any authenticated user
-- (a reseller, a customer, an unapproved merchant) could insert a row
-- with scope='platform' and created_by=themselves and it would pass
-- both the RLS check and every CHECK constraint on the table, creating
-- a live, redeemable, marketplace-wide discount voucher. Same bug class
-- as the merchant-campaigns join policy already on this table's cousin,
-- just caught before shipping a UI on top of it instead of after.
--
-- Fix follows this project's established pattern (submit_campaign_product
-- et al.): revoke direct table writes, force every write through a
-- security-definer RPC that validates role + ownership before touching
-- the row. Scope/merchant/product/category/code are immutable after
-- creation -- edit price/window/limits or deactivate and create a new
-- one if the scope itself needs to change, same tradeoff already made
-- for campaigns.

revoke insert, update, delete on public.vouchers from authenticated;

create or replace function public.create_voucher(
  p_code text,
  p_scope public.voucher_scope,
  p_discount_type public.voucher_discount_type,
  p_discount_value numeric,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_max_discount_amount numeric default null,
  p_min_spend numeric default 0,
  p_usage_limit integer default null,
  p_usage_limit_per_user integer default 1,
  p_merchant_id uuid default null,
  p_product_id uuid default null,
  p_category_id uuid default null
)
returns public.vouchers
language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_is_admin boolean;
  v_merchant_id uuid := p_merchant_id;
  v_result public.vouchers;
begin
  if v_caller is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_ends_at <= now() then raise exception 'VOUCHER_ALREADY_EXPIRED'; end if;

  v_is_admin := public.is_admin();
  if not v_is_admin then
    if not exists (select 1 from public.merchant_profiles where id = v_caller and status = 'approved') then
      raise exception 'FORBIDDEN';
    end if;
    if p_scope = 'platform' then raise exception 'FORBIDDEN'; end if;
    -- a merchant can only ever create vouchers scoped to themselves --
    -- the caller-supplied merchant_id is ignored, not just checked, so
    -- there is no way to pass someone else's id and have it stick.
    v_merchant_id := v_caller;
    if p_scope = 'product' and not exists (
      select 1 from public.products where id = p_product_id and merchant_id = v_caller
    ) then
      raise exception 'PRODUCT_NOT_FOUND';
    end if;
  end if;

  insert into public.vouchers(
    code, scope, discount_type, discount_value, max_discount_amount, min_spend,
    usage_limit, usage_limit_per_user, merchant_id, product_id, category_id,
    starts_at, ends_at, created_by
  ) values (
    p_code, p_scope, p_discount_type, p_discount_value, p_max_discount_amount, coalesce(p_min_spend, 0),
    p_usage_limit, coalesce(p_usage_limit_per_user, 1), v_merchant_id, p_product_id, p_category_id,
    p_starts_at, p_ends_at, v_caller
  ) returning * into v_result;

  return v_result;
exception
  when unique_violation then raise exception 'VOUCHER_CODE_TAKEN';
end;
$$;
revoke all on function public.create_voucher(text, public.voucher_scope, public.voucher_discount_type, numeric, timestamptz, timestamptz, numeric, numeric, integer, integer, uuid, uuid, uuid) from public, anon;
grant execute on function public.create_voucher(text, public.voucher_scope, public.voucher_discount_type, numeric, timestamptz, timestamptz, numeric, numeric, integer, integer, uuid, uuid, uuid) to authenticated;

create or replace function public.update_voucher(
  p_id uuid,
  p_discount_type public.voucher_discount_type,
  p_discount_value numeric,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_max_discount_amount numeric default null,
  p_min_spend numeric default 0,
  p_usage_limit integer default null,
  p_usage_limit_per_user integer default 1,
  p_is_active boolean default true
)
returns public.vouchers
language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_voucher public.vouchers;
  v_result public.vouchers;
begin
  if v_caller is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into v_voucher from public.vouchers where id = p_id;
  if v_voucher.id is null then raise exception 'VOUCHER_NOT_FOUND'; end if;
  if v_voucher.created_by <> v_caller and not public.is_admin() then raise exception 'FORBIDDEN'; end if;

  update public.vouchers set
    discount_type = p_discount_type,
    discount_value = p_discount_value,
    max_discount_amount = p_max_discount_amount,
    min_spend = coalesce(p_min_spend, 0),
    usage_limit = p_usage_limit,
    usage_limit_per_user = coalesce(p_usage_limit_per_user, 1),
    starts_at = p_starts_at,
    ends_at = p_ends_at,
    is_active = coalesce(p_is_active, true)
  where id = p_id returning * into v_result;

  return v_result;
end;
$$;
revoke all on function public.update_voucher(uuid, public.voucher_discount_type, numeric, timestamptz, timestamptz, numeric, numeric, integer, integer, boolean) from public, anon;
grant execute on function public.update_voucher(uuid, public.voucher_discount_type, numeric, timestamptz, timestamptz, numeric, numeric, integer, integer, boolean) to authenticated;

create or replace function public.delete_voucher(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_voucher public.vouchers;
begin
  if v_caller is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into v_voucher from public.vouchers where id = p_id;
  if v_voucher.id is null then raise exception 'VOUCHER_NOT_FOUND'; end if;
  if v_voucher.created_by <> v_caller and not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if exists (select 1 from public.voucher_redemptions where voucher_id = p_id) then
    raise exception 'VOUCHER_HAS_REDEMPTIONS';
  end if;
  delete from public.vouchers where id = p_id;
end;
$$;
revoke all on function public.delete_voucher(uuid) from public, anon;
grant execute on function public.delete_voucher(uuid) to authenticated;

notify pgrst, 'reload schema';
