-- Phase 2 of TASK6.md: per-product campaign submissions, additive to the
-- existing campaigns/merchant_campaigns tables. The existing whole-store
-- "instant join" flow (campaigns_migration.sql) is untouched and keeps
-- working exactly as before for the system-generated recurring campaigns
-- (Payday/Double Day). This new table is for merchant-initiated,
-- per-product campaigns that need a submission + optional approval step.

create type public.campaign_submission_status as enum (
  'draft', 'pending', 'approved', 'active', 'paused', 'rejected', 'expired', 'archived'
);

-- Pricing-floor and approval-requirement config, per campaign. Additive
-- columns on the existing campaigns table -- nothing existing is renamed
-- or removed, so the whole-store join flow keeps reading/writing the
-- columns it already knows about.
alter table public.campaigns add column if not exists requires_approval boolean not null default true;
alter table public.campaigns add column if not exists min_discount_percent numeric(5,2);
alter table public.campaigns add column if not exists max_discount_percent numeric(5,2);

create table public.campaign_products (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  merchant_id uuid not null references public.merchant_profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  campaign_price numeric(12,2) not null check (campaign_price > 0),
  status public.campaign_submission_status not null default 'draft',
  validation_errors jsonb not null default '[]',
  rejection_reason text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, product_id)
);

create index idx_campaign_products_campaign on public.campaign_products(campaign_id, status);
create index idx_campaign_products_merchant on public.campaign_products(merchant_id, status);
create index idx_campaign_products_product on public.campaign_products(product_id);

alter table public.campaign_products enable row level security;

create policy "campaign_products_public_read" on public.campaign_products
  for select using (status in ('approved', 'active', 'paused', 'expired'));

create policy "campaign_products_merchant_read_own" on public.campaign_products
  for select to authenticated using (merchant_id = auth.uid() or public.is_admin());

create policy "campaign_products_merchant_manage" on public.campaign_products
  for all to authenticated using (merchant_id = auth.uid() or public.is_admin())
  with check (merchant_id = auth.uid() or public.is_admin());

revoke all on public.campaign_products from anon, authenticated;
grant select on public.campaign_products to anon, authenticated;
grant insert, update, delete on public.campaign_products to authenticated;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists trg_campaign_products_updated_at on public.campaign_products;
create trigger trg_campaign_products_updated_at before update on public.campaign_products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- submit_campaign_product -- validates and creates/updates a merchant's
-- product submission to a campaign. Runs the Phase 3 validation checks
-- inline (product ownership/active/stock, campaign schedule, pricing
-- floor, no conflicting active submission for the same product) and
-- returns per-field errors instead of a single opaque exception, so the
-- UI can show a real validation report rather than a toast with one line.
-- ---------------------------------------------------------------------
create or replace function public.submit_campaign_product(
  p_campaign_id uuid,
  p_product_id uuid,
  p_campaign_price numeric
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
      campaign_price = p_campaign_price, status = v_status, validation_errors = v_errors,
      rejection_reason = null, submitted_at = case when jsonb_array_length(v_errors) = 0 then now() else submitted_at end
    where id = v_existing_id returning * into v_result;
  else
    insert into public.campaign_products (campaign_id, merchant_id, product_id, campaign_price, status, validation_errors, submitted_at)
    values (p_campaign_id, v_merchant, p_product_id, p_campaign_price, v_status, v_errors, case when jsonb_array_length(v_errors) = 0 then now() else null end)
    returning * into v_result;
  end if;

  if jsonb_array_length(v_errors) > 0 then raise exception 'VALIDATION_FAILED' using detail = v_errors::text; end if;
  return v_result;
end;
$$;
revoke all on function public.submit_campaign_product(uuid, uuid, numeric) from public, anon;
grant execute on function public.submit_campaign_product(uuid, uuid, numeric) to authenticated;

create or replace function public.withdraw_campaign_submission(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.campaign_products set status = 'archived'
  where id = p_id and merchant_id = auth.uid() and status in ('draft', 'pending', 'approved', 'active', 'paused');
  if not found then raise exception 'SUBMISSION_NOT_FOUND'; end if;
end;
$$;
revoke all on function public.withdraw_campaign_submission(uuid) from public, anon;
grant execute on function public.withdraw_campaign_submission(uuid) to authenticated;

create or replace function public.review_campaign_submission(p_id uuid, p_approve boolean, p_reason text default null)
returns public.campaign_products
language plpgsql security definer set search_path = public as $$
declare v_result public.campaign_products;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update public.campaign_products set
    status = case when p_approve then 'approved' else 'rejected' end,
    rejection_reason = case when p_approve then null else p_reason end,
    reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_id and status = 'pending'
  returning * into v_result;
  if v_result.id is null then raise exception 'SUBMISSION_NOT_PENDING'; end if;
  return v_result;
end;
$$;
revoke all on function public.review_campaign_submission(uuid, boolean, text) from public, anon;
grant execute on function public.review_campaign_submission(uuid, boolean, text) to authenticated;

notify pgrst, 'reload schema';
