-- Fix found via live testing: resolve_voucher()'s RETURNS TABLE(...,
-- voucher_id uuid) implicitly declares a PL/pgSQL variable named
-- voucher_id, which collided with voucher_redemptions.voucher_id inside
-- the two usage-count queries ("column reference voucher_id is
-- ambiguous"). Same root cause class as the campaign_submission_status
-- enum-cast bug found earlier in this project -- caught by actually
-- calling the function, not just reading it.
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
    select count(*) into v_total_used from public.voucher_redemptions vr where vr.voucher_id = v.id;
    if v_total_used >= v.usage_limit then return query select false, 'VOUCHER_USAGE_LIMIT_REACHED', 0::numeric, null::text, v.id; return; end if;
  end if;

  select count(*) into v_user_used from public.voucher_redemptions vr where vr.voucher_id = v.id and vr.user_id = p_buyer;
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

notify pgrst, 'reload schema';
