-- =====================================================================
-- JOM HUB Marketplace — System UX Overhaul Migration
-- Adds: Lalamove integration, system guides, table-friendly helpers
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. LALAMOVE SETTINGS (reseller stores their API credentials)
-- ---------------------------------------------------------------------
create table if not exists public.lalamove_settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade unique,
  api_key text,
  api_secret text,
  market text not null default 'PH_MNL',
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lalamove_settings_owner on public.lalamove_settings(owner_id);

-- ---------------------------------------------------------------------
-- 2. SYSTEM APP GUIDES (editable guide content for front pages)
-- ---------------------------------------------------------------------
create table if not exists public.app_guides (
  id uuid primary key default gen_random_uuid(),
  page_key text not null unique,
  title text not null,
  content text,
  steps jsonb default '[]',
  faqs jsonb default '[]',
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Seed default guides
insert into public.app_guides (page_key, title, content, steps, faqs) values
('product-flow', 'Product Order Flow',
 'How Merchants sell and Resellers buy products through JOM HUB.',
 '[
   {"step": 1, "icon": "store", "title": "Merchant lists products", "text": "Merchant adds products with pricing, stock, and shipping details."},
   {"step": 2, "icon": "search", "title": "Reseller browses catalog", "text": "Reseller finds products and adds them to their storefront list."},
   {"step": 3, "icon": "cart", "title": "Order is placed", "text": "Reseller adds products to cart, selects customer, and checks out."},
   {"step": 4, "icon": "wallet", "title": "Payment is processed", "text": "Wallet is debited for product + system fee. Shipping is paid upon delivery."},
   {"step": 5, "icon": "package", "title": "Merchant ships order", "text": "Merchant packages, enters shipping fee, dispatches with tracking."},
   {"step": 6, "icon": "check", "title": "Delivery confirmed", "text": "Reseller confirms receipt. Payout is released to Merchant wallet."}
 ]',
 '[{"q": "How long does shipping take?", "a": "Shipping depends on the courier and distance. Merchants provide estimated delivery dates."},
   {"q": "What if an item is out of stock?", "a": "The system checks stock at checkout. You will be notified if stock is insufficient."},
   {"q": "Can I cancel an order?", "a": "Yes, you can request a cancellation. The Merchant must approve it before processing."}]'),
('clinic-flow', 'Clinic Referral Flow',
 'How Resellers earn referral fees by sending customers to partner clinics.',
 '[
   {"step": 1, "icon": "stethoscope", "title": "Merchant sets clinic services", "text": "Clinic merchants add services (dental, optical) with fees and referral fees."},
   {"step": 2, "icon": "users", "title": "Reseller browses clinics", "text": "Reseller views available clinics and their service offerings."},
   {"step": 3, "icon": "send", "title": "Customer is referred", "text": "Reseller selects a customer and refers them to the chosen clinic service."},
   {"step": 4, "icon": "clock", "title": "Clinic confirms", "text": "Clinic merchant confirms the referral and contacts the patient to schedule."},
   {"step": 5, "icon": "check", "title": "Appointment completed", "text": "After the service is done, clinic marks the appointment as completed."},
   {"step": 6, "icon": "dollar", "title": "Referral fee paid", "text": "Referral fee is auto-transferred from clinic wallet to reseller wallet."}
 ]',
 '[{"q": "How do I get paid?", "a": "Referral fees are automatically transferred to your wallet when the clinic marks the appointment as completed."},
   {"q": "What if the customer doesn''t show up?", "a": "The clinic can cancel the referral. No fee is charged."},
   {"q": "Can I refer walk-in customers?", "a": "Yes! You can enter customer details manually even if they are not in your saved list."}]'),
('shipping-flow', 'Shipping & Delivery Flow',
 'How shipping fees are calculated and how deliveries work with Lalamove integration.',
 '[
   {"step": 1, "icon": "truck", "title": "Choose delivery method", "text": "During checkout, choose standard shipping or Lalamove (if connected)."},
   {"step": 2, "icon": "ruler", "title": "Merchant packages order", "text": "Merchant weighs and measures the packed items for shipping calculation."},
   {"step": 3, "icon": "calculator", "title": "Shipping fee is set", "text": "Merchant enters actual shipping fee. Reseller must approve it."},
   {"step": 4, "icon": "map", "title": "Order is dispatched", "text": "Merchant provides delivery provider, tracking number, and dispatch proof."},
   {"step": 5, "icon": "package-check", "title": "Delivery received", "text": "Reseller confirms delivery. Any disputes must be raised within 7 days."}
 ]',
 '[{"q": "How is shipping fee calculated?", "a": "Standard: based on distance, weight, and package size. Lalamove: real-time API quote."},
   {"q": "Can I use my own Lalamove account?", "a": "Yes! Go to Delivery Settings to connect your Lalamove API key for auto-quotes."},
   {"q": "Who pays the shipping fee?", "a": "The reseller or customer pays the shipping fee directly to the rider upon delivery."}]')
on conflict (page_key) do nothing;

-- ---------------------------------------------------------------------
-- 3. RPC: Get app guide content
-- ---------------------------------------------------------------------
create or replace function public.get_app_guide(p_page_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guide jsonb;
begin
  select jsonb_build_object(
    'title', title,
    'content', content,
    'steps', steps,
    'faqs', faqs
  ) into v_guide
  from public.app_guides
  where page_key = p_page_key and is_active = true;

  return v_guide;
end;
$$;

grant execute on function public.get_app_guide(text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. RPC: Save/update Lalamove settings
-- ---------------------------------------------------------------------
create or replace function public.save_lalamove_settings(
  p_api_key text,
  p_api_secret text,
  p_market text default 'PH_MNL',
  p_is_enabled boolean default false
)
returns public.lalamove_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_result public.lalamove_settings;
begin
  if v_owner_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  insert into public.lalamove_settings (owner_id, api_key, api_secret, market, is_enabled)
  values (v_owner_id, p_api_key, p_api_secret, p_market, p_is_enabled)
  on conflict (owner_id) do update set
    api_key = coalesce(p_api_key, lalamove_settings.api_key),
    api_secret = coalesce(p_api_secret, lalamove_settings.api_secret),
    market = coalesce(p_market, lalamove_settings.market),
    is_enabled = coalesce(p_is_enabled, lalamove_settings.is_enabled),
    updated_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.save_lalamove_settings(text, text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 5. RPC: Get Lalamove settings for current user
-- ---------------------------------------------------------------------
create or replace function public.get_lalamove_settings()
returns public.lalamove_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_result public.lalamove_settings;
begin
  select * into v_result
  from public.lalamove_settings
  where owner_id = v_owner_id;

  return v_result;
end;
$$;

grant execute on function public.get_lalamove_settings() to authenticated;

-- ---------------------------------------------------------------------
-- 6. RLS for lalamove_settings
-- ---------------------------------------------------------------------
alter table public.lalamove_settings enable row level security;

create policy "lalamove_settings_owner_all" on public.lalamove_settings
  for all using (owner_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- 7. Add lalamove fields to orders table (if not exist)
-- ---------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'lalamove_delivery_id') then
    alter table public.orders add column lalamove_delivery_id text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'lalamove_quote_id') then
    alter table public.orders add column lalamove_quote_id text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'lalamove_quote_data') then
    alter table public.orders add column lalamove_quote_data jsonb;
  end if;
end $$;

-- =====================================================================
-- DONE. Run with: supabase db push --linked
-- =====================================================================
