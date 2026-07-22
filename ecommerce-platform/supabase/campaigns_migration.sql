-- Admin-managed marketplace campaigns joined by approved merchants.
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 3 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  discount_percent numeric(5,2) not null check (discount_percent > 0 and discount_percent < 100),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create table if not exists public.merchant_campaigns (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  merchant_id uuid not null references public.merchant_profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (campaign_id, merchant_id)
);
create index if not exists idx_campaign_dates on public.campaigns(is_active, starts_at, ends_at);
create index if not exists idx_merchant_campaigns_merchant on public.merchant_campaigns(merchant_id);
alter table public.campaigns enable row level security;
alter table public.merchant_campaigns enable row level security;
create policy "campaigns_public_read" on public.campaigns for select using (true);
create policy "campaigns_admin_manage" on public.campaigns for all to authenticated using (public.is_admin()) with check (public.is_admin() and created_by = auth.uid());
create policy "merchant_campaigns_public_read" on public.merchant_campaigns for select using (true);
create policy "merchant_campaigns_join" on public.merchant_campaigns for insert to authenticated with check (
  merchant_id = auth.uid() and exists (select 1 from public.merchant_profiles mp where mp.id = auth.uid() and mp.status = 'approved')
  and exists (select 1 from public.campaigns c where c.id = campaign_id and c.is_active and c.ends_at > now())
);
create policy "merchant_campaigns_leave" on public.merchant_campaigns for delete to authenticated using (merchant_id = auth.uid() or public.is_admin());
grant select on public.campaigns, public.merchant_campaigns to anon, authenticated;
grant insert, delete on public.merchant_campaigns to authenticated;
grant insert, update, delete on public.campaigns to authenticated;

-- Campaign price overrides quantity tiers while a joined campaign is active.
create or replace function public.product_unit_price(p_product_id uuid, p_quantity integer)
returns numeric language sql stable security definer set search_path = public as $$
  select case when active_campaign.discount_percent is not null
    then round(p.price * (1 - active_campaign.discount_percent / 100), 2)
    else least(p.price, coalesce((select min((tier->>'price')::numeric) from jsonb_array_elements(p.discount_tiers) tier where (tier->>'min_qty')::integer <= p_quantity), p.price)) end
  from public.products p
  left join lateral (
    select max(c.discount_percent) discount_percent from public.merchant_campaigns mc join public.campaigns c on c.id = mc.campaign_id
    where mc.merchant_id = p.merchant_id and c.is_active and now() between c.starts_at and c.ends_at
  ) active_campaign on true where p.id = p_product_id;
$$;
