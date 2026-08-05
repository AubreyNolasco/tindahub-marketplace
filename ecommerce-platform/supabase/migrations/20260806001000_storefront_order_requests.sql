-- =====================================================================
-- Customer Storefront Ordering — Batch 2
--
-- A customer browsing a public Reseller storefront can currently only
-- see "How to Buy" instructions (contact the Reseller externally). This
-- adds a staging table + the app's first anon-write RPC so a customer
-- can submit an order request directly, which the Reseller then reviews
-- in a new inbox (Batch 4) and converts into a real order using the
-- existing, UNCHANGED wallet-safe checkout path (quote_order ->
-- place_customer_receiver_shipping_order -> place_order). This table
-- and RPC never touch money, stock, or the orders table directly.
-- =====================================================================

create table if not exists public.storefront_order_requests (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  customer_name text not null,
  customer_phone text,
  customer_address text,
  customer_notes text,
  status text not null default 'pending' check (status in ('pending','accepted','declined','converted')),
  reseller_response_note text,
  converted_customer_id uuid references public.customers(id) on delete set null,
  converted_order_id uuid references public.orders(id) on delete set null,
  submission_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists idx_storefront_order_requests_reseller on public.storefront_order_requests(reseller_id, status);
create index if not exists idx_storefront_order_requests_fingerprint on public.storefront_order_requests(submission_fingerprint, created_at);

alter table public.storefront_order_requests enable row level security;

-- Owner-only read/update, same convention as customers_owner_all. No
-- insert policy for anyone -- every insert goes through the
-- security-definer RPC below, which validates and rate-limits first.
drop policy if exists "storefront_order_requests_owner_read" on public.storefront_order_requests;
create policy "storefront_order_requests_owner_read" on public.storefront_order_requests
  for select to authenticated using (reseller_id = auth.uid() or public.is_admin());

drop policy if exists "storefront_order_requests_owner_update" on public.storefront_order_requests;
create policy "storefront_order_requests_owner_update" on public.storefront_order_requests
  for update to authenticated using (reseller_id = auth.uid() or public.is_admin())
  with check (reseller_id = auth.uid() or public.is_admin());

grant select, update on public.storefront_order_requests to authenticated;

-- ---------------------------------------------------------------------
-- submit_storefront_order_request — the app's first anon-write RPC.
-- Validates the reseller/product/quantity against real data, sanitizes
-- every text input (same trim+length-cap approach as
-- guard_public_appointment_submission in launch_security_audit_fixes.sql),
-- and rate-limits by caller IP using the same fingerprint pattern --
-- the one existing precedent for a public write in this app.
-- ---------------------------------------------------------------------
create or replace function public.submit_storefront_order_request(
  p_reseller_id uuid,
  p_product_id uuid,
  p_quantity int,
  p_customer_name text,
  p_customer_phone text default null,
  p_customer_address text default null,
  p_customer_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reseller public.profiles;
  v_product public.products;
  v_name text;
  v_phone text;
  v_address text;
  v_notes text;
  v_headers jsonb;
  v_caller_ip text;
  v_fingerprint text;
  v_id uuid;
begin
  select * into v_reseller from public.profiles where id = p_reseller_id;
  if v_reseller.id is null or v_reseller.role <> 'reseller' or v_reseller.account_status <> 'approved' then
    raise exception 'RESELLER_NOT_AVAILABLE';
  end if;

  if not exists (
    select 1 from public.reseller_storefront_products
    where reseller_id = p_reseller_id and product_id = p_product_id
  ) then
    raise exception 'PRODUCT_NOT_ON_STOREFRONT';
  end if;

  select * into v_product from public.products where id = p_product_id;
  if v_product.id is null or not v_product.is_active then
    raise exception 'PRODUCT_UNAVAILABLE';
  end if;

  if p_quantity is null or p_quantity < greatest(1, v_product.min_order_qty) then
    raise exception 'QUANTITY_BELOW_MINIMUM';
  end if;
  if p_quantity > v_product.stock_quantity then
    raise exception 'QUANTITY_EXCEEDS_STOCK';
  end if;

  v_name := left(trim(coalesce(p_customer_name, '')), 200);
  if char_length(v_name) < 2 then
    raise exception 'CUSTOMER_NAME_REQUIRED';
  end if;
  v_phone := nullif(left(regexp_replace(coalesce(p_customer_phone,''), '[^0-9+ ]', '', 'g'), 30), '');
  v_address := nullif(left(trim(coalesce(p_customer_address, '')), 500), '');
  v_notes := nullif(left(trim(coalesce(p_customer_notes, '')), 500), '');

  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
    v_caller_ip := coalesce(v_headers->>'cf-connecting-ip', split_part(v_headers->>'x-forwarded-for', ',', 1));
  exception when others then
    v_caller_ip := null;
  end;

  if v_caller_ip is not null then
    v_fingerprint := md5(v_caller_ip);
    if (
      select count(*) from public.storefront_order_requests
      where created_at > now() - interval '1 hour' and submission_fingerprint = v_fingerprint
    ) >= 5 then
      raise exception 'TOO_MANY_ORDER_REQUESTS';
    end if;
  end if;

  insert into public.storefront_order_requests (
    reseller_id, product_id, quantity, customer_name, customer_phone, customer_address, customer_notes, submission_fingerprint
  ) values (
    p_reseller_id, p_product_id, p_quantity, v_name, v_phone, v_address, v_notes, v_fingerprint
  ) returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.submit_storefront_order_request(uuid, uuid, int, text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
