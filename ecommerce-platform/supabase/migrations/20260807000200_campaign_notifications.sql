-- Phase 12 of TASK6.md: Notifications. `public.notifications` and
-- `create_notification()` (20260804000100_integration_scaffolding.sql)
-- have been deployed since Phase-8-era work but had zero producers --
-- confirmed by grepping every migration for `create_notification(`,
-- which only ever matches its own definition. It exists "for new
-- [events with] no natural source row to derive a notification from"
-- (that migration's own comment) -- campaign product approval/rejection
-- and campaign activation/expiry are exactly that: there's no
-- pending-request table a merchant can poll the way withdrawal/topup
-- requests work in RoleNotifications.jsx's existing derived feed.
--
-- Two producers added here, both from functions that already run as
-- security definer and already have (or can cheaply get) the
-- merchant_id to notify -- campaign_products.merchant_id is a direct
-- column, no join needed (confirmed against the table's own definition
-- in 20260806001200_campaign_products.sql):
--   1. review_campaign_submission() -- approve/reject, unchanged logic,
--      notification added right after the existing update.
--   2. run_campaign_scheduler() -- rewritten from four bulk
--      UPDATE...FROM statements into four FOR-loops driven by
--      UPDATE...RETURNING (a plain PL/pgSQL FOR-IN-query accepts any
--      row-returning command, DML included) so each affected
--      campaign_products row's merchant_id is available to notify,
--      not just an aggregate row count.

create or replace function public.review_campaign_submission(p_id uuid, p_approve boolean, p_reason text default null)
returns public.campaign_products
language plpgsql security definer set search_path = public as $$
declare
  v_result public.campaign_products;
  v_campaign_name text;
  v_product_name text;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update public.campaign_products set
    status = (case when p_approve then 'approved' else 'rejected' end)::public.campaign_submission_status,
    rejection_reason = case when p_approve then null else p_reason end,
    reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_id and status = 'pending'
  returning * into v_result;
  if v_result.id is null then raise exception 'SUBMISSION_NOT_PENDING'; end if;

  select name into v_campaign_name from public.campaigns where id = v_result.campaign_id;
  select name into v_product_name from public.products where id = v_result.product_id;
  perform public.create_notification(
    v_result.merchant_id, 'campaign',
    case when p_approve then format('%s approved for %s', v_product_name, v_campaign_name) else format('%s rejected for %s', v_product_name, v_campaign_name) end,
    case when p_approve then format('Your campaign price of %s is now approved.', v_result.campaign_price) else coalesce(p_reason, 'No reason was given.') end,
    '/merchant/campaigns',
    jsonb_build_object('campaign_id', v_result.campaign_id, 'product_id', v_result.product_id, 'campaign_product_id', v_result.id)
  );

  return v_result;
end;
$$;
revoke all on function public.review_campaign_submission(uuid, boolean, text) from public, anon;
grant execute on function public.review_campaign_submission(uuid, boolean, text) to authenticated;

create or replace function public.run_campaign_scheduler()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activated integer := 0;
  v_expired integer := 0;
  v_paused integer := 0;
  v_resumed integer := 0;
  r record;
begin
  perform public.ensure_recurring_campaigns();

  for r in
    update public.campaign_products cp set status = 'active'
    from public.campaigns c, public.products p
    where cp.campaign_id = c.id and cp.product_id = p.id
      and cp.status = 'approved' and c.is_active and now() between c.starts_at and c.ends_at
    returning cp.merchant_id, cp.id as campaign_product_id, cp.campaign_id, cp.product_id, c.name as campaign_name, p.name as product_name
  loop
    v_activated := v_activated + 1;
    perform public.create_notification(r.merchant_id, 'campaign', format('%s is now live in %s', r.product_name, r.campaign_name),
      'Your campaign price is now active and visible to shoppers.', '/merchant/campaigns',
      jsonb_build_object('campaign_id', r.campaign_id, 'product_id', r.product_id, 'campaign_product_id', r.campaign_product_id));
  end loop;

  for r in
    update public.campaign_products cp set status = 'expired'
    from public.campaigns c, public.products p
    where cp.campaign_id = c.id and cp.product_id = p.id
      and cp.status in ('draft', 'pending', 'approved', 'active', 'paused') and c.ends_at <= now()
    returning cp.merchant_id, cp.id as campaign_product_id, cp.campaign_id, cp.product_id, c.name as campaign_name, p.name as product_name
  loop
    v_expired := v_expired + 1;
    perform public.create_notification(r.merchant_id, 'campaign', format('%s ended for %s', r.product_name, r.campaign_name),
      'This campaign has ended. The product is back to its regular price.', '/merchant/campaigns',
      jsonb_build_object('campaign_id', r.campaign_id, 'product_id', r.product_id, 'campaign_product_id', r.campaign_product_id));
  end loop;

  for r in
    update public.campaign_products cp set status = 'paused'
    from public.campaigns c, public.products p
    where cp.campaign_id = c.id and cp.product_id = p.id and cp.status = 'active' and not c.is_active
    returning cp.merchant_id, cp.id as campaign_product_id, cp.campaign_id, cp.product_id, c.name as campaign_name, p.name as product_name
  loop
    v_paused := v_paused + 1;
    perform public.create_notification(r.merchant_id, 'campaign', format('%s paused in %s', r.product_name, r.campaign_name),
      'The admin disabled this campaign, so your campaign price is temporarily paused.', '/merchant/campaigns',
      jsonb_build_object('campaign_id', r.campaign_id, 'product_id', r.product_id, 'campaign_product_id', r.campaign_product_id));
  end loop;

  for r in
    update public.campaign_products cp set status = 'active'
    from public.campaigns c, public.products p
    where cp.campaign_id = c.id and cp.product_id = p.id
      and cp.status = 'paused' and c.is_active and now() between c.starts_at and c.ends_at
    returning cp.merchant_id, cp.id as campaign_product_id, cp.campaign_id, cp.product_id, c.name as campaign_name, p.name as product_name
  loop
    v_resumed := v_resumed + 1;
    perform public.create_notification(r.merchant_id, 'campaign', format('%s resumed in %s', r.product_name, r.campaign_name),
      'The admin re-enabled this campaign, so your campaign price is active again.', '/merchant/campaigns',
      jsonb_build_object('campaign_id', r.campaign_id, 'product_id', r.product_id, 'campaign_product_id', r.campaign_product_id));
  end loop;

  return jsonb_build_object('activated', v_activated, 'expired', v_expired, 'paused', v_paused, 'resumed', v_resumed);
end;
$$;

notify pgrst, 'reload schema';
