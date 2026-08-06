-- Bug found via code review (not yet hit in production): the previous
-- version of this function did `raise exception 'VALIDATION_FAILED' ...`
-- AFTER already inserting/updating the row with status='draft'. In
-- Postgres, an unhandled RAISE EXCEPTION rolls back everything done
-- earlier in the same function invocation (no local exception handler /
-- savepoint here) -- so the "save as draft with validation notes" never
-- actually persisted; the caller got an error and nothing to show for it.
-- Fix: return the row normally on validation failure (status stays
-- 'draft', validation_errors populated) instead of raising. The frontend
-- now branches on the returned row's validation_errors instead of
-- catching an RPC error for this case.
create or replace function public.submit_campaign_product(
  p_campaign_id uuid,
  p_product_id uuid,
  p_campaign_price numeric,
  p_stock_allocation integer default null
)
returns public.campaign_products
language plpgsql security definer set search_path = public as $$
declare
  v_merchant uuid := auth.uid();
  v_campaign public.campaigns;
  v_product public.products;
  v_errors jsonb := '[]'::jsonb;
  v_discount_percent numeric;
  v_status public.campaign_submission_status;
  v_existing_id uuid;
  v_result public.campaign_products;
begin
  select * into v_campaign from public.campaigns where id = p_campaign_id;
  if v_campaign.id is null then raise exception 'CAMPAIGN_NOT_FOUND'; end if;
  if not v_campaign.is_active then v_errors := v_errors || '["Campaign is not active."]'::jsonb; end if;
  if v_campaign.ends_at <= now() then v_errors := v_errors || '["Campaign has already ended."]'::jsonb; end if;

  select * into v_product from public.products where id = p_product_id;
  if v_product.id is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if v_product.merchant_id <> v_merchant then raise exception 'FORBIDDEN'; end if;
  if not v_product.is_active then v_errors := v_errors || '["Product is not active."]'::jsonb; end if;
  if v_product.stock_quantity <= 0 then v_errors := v_errors || '["Product has no stock."]'::jsonb; end if;

  if p_stock_allocation is not null and p_stock_allocation > v_product.stock_quantity then
    v_errors := v_errors || to_jsonb(format('Stock allocation of %s exceeds available stock of %s.', p_stock_allocation, v_product.stock_quantity));
  end if;

  if p_campaign_price >= v_product.price then
    v_errors := v_errors || '["Campaign price must be lower than the regular price."]'::jsonb;
  end if;

  v_discount_percent := round((1 - p_campaign_price / v_product.price) * 100, 2);
  if v_campaign.max_discount_percent is not null and v_discount_percent > v_campaign.max_discount_percent then
    v_errors := v_errors || to_jsonb(format('Discount of %s%% exceeds this campaign''s maximum of %s%%.', v_discount_percent, v_campaign.max_discount_percent));
  end if;
  if v_campaign.min_discount_percent is not null and v_discount_percent < v_campaign.min_discount_percent then
    v_errors := v_errors || to_jsonb(format('Discount of %s%% is below this campaign''s minimum of %s%%.', v_discount_percent, v_campaign.min_discount_percent));
  end if;

  if exists (
    select 1 from public.campaign_products cp
    join public.campaigns c on c.id = cp.campaign_id
    where cp.product_id = p_product_id and cp.campaign_id <> p_campaign_id
      and cp.status in ('approved', 'active')
      and c.starts_at < v_campaign.ends_at and c.ends_at > v_campaign.starts_at
  ) then
    v_errors := v_errors || '["Product is already enrolled in another campaign with an overlapping schedule."]'::jsonb;
  end if;

  select id into v_existing_id from public.campaign_products where campaign_id = p_campaign_id and product_id = p_product_id;

  v_status := case when jsonb_array_length(v_errors) > 0 then 'draft'
    when v_campaign.requires_approval then 'pending' else 'approved' end;

  if v_existing_id is not null then
    update public.campaign_products set
      campaign_price = p_campaign_price, stock_allocation = p_stock_allocation, status = v_status, validation_errors = v_errors,
      rejection_reason = null, submitted_at = case when jsonb_array_length(v_errors) = 0 then now() else submitted_at end
    where id = v_existing_id returning * into v_result;
  else
    insert into public.campaign_products (campaign_id, merchant_id, product_id, campaign_price, stock_allocation, status, validation_errors, submitted_at)
    values (p_campaign_id, v_merchant, p_product_id, p_campaign_price, p_stock_allocation, v_status, v_errors, case when jsonb_array_length(v_errors) = 0 then now() else null end)
    returning * into v_result;
  end if;

  return v_result;
end;
$$;
revoke all on function public.submit_campaign_product(uuid, uuid, numeric, integer) from public, anon;
grant execute on function public.submit_campaign_product(uuid, uuid, numeric, integer) to authenticated;

notify pgrst, 'reload schema';
