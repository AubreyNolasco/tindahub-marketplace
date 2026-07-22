-- RM Hub defense-in-depth hardening. Run after signup_approval_migration.sql.
-- Protects privileged columns, state transitions, RPC access, and file storage.

create or replace function public.is_approved_account()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select account_status = 'approved' from public.profiles where id = auth.uid()), false);
$$;
revoke all on function public.is_approved_account() from public;
grant execute on function public.is_approved_account() to authenticated;

-- Never trust a role supplied in signup metadata beyond the two public roles.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role user_role;
begin
  v_role := case when new.raw_user_meta_data->>'role' = 'merchant' then 'merchant'::user_role else 'reseller'::user_role end;
  insert into public.profiles (id, full_name, role, phone, account_status)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)), 120),
    v_role,
    left(coalesce(new.raw_user_meta_data->>'phone', ''), 30),
    'pending'
  ) on conflict (id) do nothing;
  if v_role = 'merchant' then
    insert into public.merchant_profiles (id, business_name, status)
    values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'business_name'), ''), 'My Store'), 160), 'pending')
    on conflict (id) do nothing;
  else
    insert into public.wallets (owner_id, balance) values (new.id, 0) on conflict (owner_id) do nothing;
  end if;
  return new;
end; $$;

-- Owners may edit display data, but never their role or approval state.
create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() is null for trusted SQL Editor/migration sessions. Anonymous
  -- API callers still cannot reach UPDATE because RLS denies them.
  if auth.uid() is not null and not public.is_admin() and (
    new.id is distinct from old.id or new.role is distinct from old.role or
    new.account_status is distinct from old.account_status or new.created_at is distinct from old.created_at
  ) then raise exception 'PROTECTED_PROFILE_FIELDS'; end if;
  new.full_name := left(trim(new.full_name), 120);
  new.phone := left(new.phone, 30);
  return new;
end; $$;
drop trigger if exists trg_protect_profile_privileges on public.profiles;
create trigger trg_protect_profile_privileges before update on public.profiles
for each row execute function public.protect_profile_privileges();

-- Merchant owners cannot self-approve or manufacture a subscription.
create or replace function public.protect_merchant_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() and (
    new.id is distinct from old.id or new.status is distinct from old.status or
    new.subscription_active is distinct from old.subscription_active or
    new.subscription_expires_at is distinct from old.subscription_expires_at or
    new.trial_ends_at is distinct from old.trial_ends_at or new.created_at is distinct from old.created_at
  ) then raise exception 'PROTECTED_MERCHANT_FIELDS'; end if;
  new.business_name := left(trim(new.business_name), 160);
  new.business_description := left(new.business_description, 2000);
  new.business_address := left(new.business_address, 500);
  return new;
end; $$;
drop trigger if exists trg_protect_merchant_privileges on public.merchant_profiles;
create trigger trg_protect_merchant_privileges before update on public.merchant_profiles
for each row execute function public.protect_merchant_privileges();

-- Client-created requests must always start pending and unreviewed.
create or replace function public.protect_new_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or new.owner_id <> auth.uid() then raise exception 'INVALID_REQUEST_OWNER'; end if;
  if new.status <> 'pending' or new.reviewed_by is not null or new.reviewed_at is not null or new.admin_notes is not null then
    raise exception 'INVALID_INITIAL_REQUEST_STATE';
  end if;
  new.reference_number := left(trim(new.reference_number), 120);
  if new.proof_url is null or new.proof_url !~ ('^' || auth.uid()::text || '/[A-Za-z0-9._-]+$') then raise exception 'INVALID_PROOF_PATH'; end if;
  return new;
end; $$;
drop trigger if exists trg_protect_new_topup on public.topup_requests;
create trigger trg_protect_new_topup before insert on public.topup_requests for each row execute function public.protect_new_request();
drop trigger if exists trg_protect_new_subscription_request on public.subscription_requests;
create trigger trg_protect_new_subscription_request before insert on public.subscription_requests for each row execute function public.protect_new_request();

-- Admin reviews may change review fields only; money, owner and proof stay immutable.
create or replace function public.protect_request_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REVIEW_REQUIRED'; end if;
  if old.status <> 'pending' or new.status not in ('approved','rejected') or
     (to_jsonb(new) - array['status','admin_notes','reviewed_by','reviewed_at']) <>
     (to_jsonb(old) - array['status','admin_notes','reviewed_by','reviewed_at']) or
     new.reviewed_by <> auth.uid() or new.reviewed_at is null then
    raise exception 'INVALID_REVIEW_UPDATE';
  end if;
  new.admin_notes := left(new.admin_notes, 1000);
  return new;
end; $$;
drop trigger if exists trg_protect_topup_review on public.topup_requests;
create trigger trg_protect_topup_review before update on public.topup_requests for each row execute function public.protect_request_review();
drop trigger if exists trg_protect_withdrawal_review on public.withdrawal_requests;
create trigger trg_protect_withdrawal_review before update on public.withdrawal_requests for each row execute function public.protect_request_review();
drop trigger if exists trg_protect_subscription_review on public.subscription_requests;
create trigger trg_protect_subscription_review before update on public.subscription_requests for each row execute function public.protect_request_review();

-- All orders must originate from the atomic RPC with an approved buyer/store.
create or replace function public.validate_new_order()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or new.reseller_id <> auth.uid() or not public.is_approved_account() then raise exception 'ACCOUNT_NOT_APPROVED'; end if;
  if not exists (select 1 from public.merchant_profiles where id = new.merchant_id and status = 'approved') then raise exception 'MERCHANT_NOT_APPROVED'; end if;
  if new.subtotal < 0 or new.shipping_fee < 0 or new.total < 0 or new.reseller_operation_fee < 0 or char_length(coalesce(new.shipping_address,'')) not between 5 and 500 then raise exception 'INVALID_ORDER_DATA'; end if;
  return new;
end; $$;
drop trigger if exists trg_validate_new_order on public.orders;
create trigger trg_validate_new_order before insert on public.orders for each row execute function public.validate_new_order();

-- Enforce participant-specific order state transitions even through direct API calls.
create or replace function public.enforce_order_transition()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role user_role;
begin
  if public.is_admin() or new.status = old.status then return new; end if;
  select role into v_role from public.profiles where id = auth.uid();
  if v_role = 'merchant' and old.merchant_id = auth.uid() and (
    (old.status = 'payment_review' and new.status in ('confirmed','cancelled')) or
    (old.status = 'confirmed' and new.status = 'processing') or
    (old.status = 'processing' and new.status = 'shipped')
  ) then return new; end if;
  if old.reseller_id = auth.uid() and old.status = 'shipped' and new.status = 'completed' then return new; end if;
  raise exception 'INVALID_ORDER_STATUS_TRANSITION';
end; $$;
drop trigger if exists trg_enforce_order_transition on public.orders;
create trigger trg_enforce_order_transition before update on public.orders
for each row execute function public.enforce_order_transition();

-- Parties may change only workflow status; order identity and delivery details
-- are frozen after the atomic checkout. Financial fields remain covered by the
-- existing trg_lock_order_financials trigger.
create or replace function public.protect_order_identity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('app.assigning_order_customer', true) = 'true' then return new; end if;
  if auth.uid() is not null and not public.is_admin() and (
    new.id is distinct from old.id or new.order_number is distinct from old.order_number or
    new.customer_id is distinct from old.customer_id or new.shipping_address is distinct from old.shipping_address or
    new.notes is distinct from old.notes or new.created_at is distinct from old.created_at
  ) then raise exception 'ORDER_IDENTITY_LOCKED'; end if;
  return new;
end; $$;
drop trigger if exists trg_protect_order_identity on public.orders;
create trigger trg_protect_order_identity before update on public.orders
for each row execute function public.protect_order_identity();

-- A merchant may review status only; payment identity and amount are immutable.
create or replace function public.protect_payment_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if new.id is distinct from old.id or new.order_id is distinct from old.order_id or
     new.amount is distinct from old.amount or new.method is distinct from old.method or
     new.reference_number is distinct from old.reference_number or new.proof_url is distinct from old.proof_url or
     new.created_at is distinct from old.created_at or new.status not in ('verified','rejected') or
     old.status not in ('pending','submitted') or new.verified_by <> auth.uid() then
    raise exception 'INVALID_PAYMENT_UPDATE';
  end if;
  return new;
end; $$;
drop trigger if exists trg_protect_payment_update on public.payments;
create trigger trg_protect_payment_update before update on public.payments
for each row execute function public.protect_payment_update();

-- Chat edits are limited to the recipient marking an unchanged message as read.
create or replace function public.protect_chat_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if auth.uid() = old.sender_id or new.id is distinct from old.id or new.sender_id is distinct from old.sender_id or
     new.merchant_id is distinct from old.merchant_id or new.reseller_id is distinct from old.reseller_id or
     new.message is distinct from old.message or new.created_at is distinct from old.created_at or new.is_read is not true then
    raise exception 'INVALID_CHAT_UPDATE';
  end if;
  return new;
end; $$;
drop trigger if exists trg_protect_chat_update on public.chat_messages;
create trigger trg_protect_chat_update before update on public.chat_messages
for each row execute function public.protect_chat_update();

-- Replace broad write policies with approved-role checks and explicit WITH CHECK.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "merchant_profile_owner_update" on public.merchant_profiles;
create policy "merchant_profile_owner_update" on public.merchant_profiles for update
  using (id = auth.uid() and public.is_approved_account()) with check (id = auth.uid());
drop policy if exists "merchant_profile_owner_insert" on public.merchant_profiles;

drop policy if exists "products_merchant_insert" on public.products;
create policy "products_merchant_insert" on public.products for insert
  with check (merchant_id = auth.uid() and public.current_user_role() = 'merchant' and public.is_approved_account());
drop policy if exists "products_merchant_update" on public.products;
create policy "products_merchant_update" on public.products for update
  using ((merchant_id = auth.uid() and public.current_user_role() = 'merchant' and public.is_approved_account()) or public.is_admin())
  with check ((merchant_id = auth.uid() and public.current_user_role() = 'merchant' and public.is_approved_account()) or public.is_admin());

drop policy if exists "customers_owner_all" on public.customers;
create policy "customers_owner_all" on public.customers for all
  using ((reseller_id = auth.uid() and public.current_user_role() = 'reseller' and public.is_approved_account()) or public.is_admin())
  with check ((reseller_id = auth.uid() and public.current_user_role() = 'reseller' and public.is_approved_account()) or public.is_admin());

-- Order creation is available only through place_order(), which validates live prices,
-- stock and wallet balance atomically. Direct table inserts would bypass those checks.
drop policy if exists "orders_reseller_insert" on public.orders;
drop policy if exists "order_items_reseller_insert" on public.order_items;
drop policy if exists "payments_reseller_insert" on public.payments;

drop policy if exists "chat_participant_insert" on public.chat_messages;
create policy "chat_participant_insert" on public.chat_messages for insert with check (
  public.is_approved_account() and sender_id = auth.uid() and
  ((public.current_user_role() = 'merchant' and merchant_id = auth.uid()) or
   (public.current_user_role() = 'reseller' and reseller_id = auth.uid())) and
  char_length(message) between 1 and 2000
);

-- Lock storage writes to the caller's own folder and safe image formats/sizes.
drop policy if exists "product_images_merchant_write" on storage.objects;
create policy "product_images_merchant_write" on storage.objects for insert with check (
  bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text and
  public.current_user_role() = 'merchant' and public.is_approved_account() and
  lower(storage.extension(name)) in ('jpg','jpeg','png','webp') and
  coalesce((metadata->>'size')::bigint, 0) <= 5242880
);
drop policy if exists "payment_proofs_owner_write" on storage.objects;
create policy "payment_proofs_owner_write" on storage.objects for insert with check (
  bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text and
  lower(storage.extension(name)) in ('jpg','jpeg','png','webp') and
  coalesce((metadata->>'size')::bigint, 0) <= 5242880
);
update storage.buckets set file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp']
where id in ('product-images', 'payment-proofs');

-- SECURITY DEFINER functions must not be callable anonymously or by PUBLIC.
revoke execute on function public.place_order(uuid, text, jsonb, numeric) from public, anon;
revoke execute on function public.request_withdrawal(numeric, text, text, text) from public, anon;
grant execute on function public.place_order(uuid, text, jsonb, numeric) to authenticated;
grant execute on function public.request_withdrawal(numeric, text, text, text) to authenticated;

-- Add reasonable data limits that stop oversized payload abuse.
alter table public.chat_messages drop constraint if exists chat_message_length;
alter table public.chat_messages add constraint chat_message_length check (char_length(message) between 1 and 2000) not valid;
alter table public.products drop constraint if exists product_text_lengths;
alter table public.products add constraint product_text_lengths check (char_length(name) between 1 and 200 and char_length(coalesce(description,'')) <= 5000) not valid;
alter table public.orders drop constraint if exists order_nonnegative_financials;
alter table public.orders add constraint order_nonnegative_financials check (subtotal >= 0 and shipping_fee >= 0 and total >= 0 and reseller_operation_fee >= 0 and platform_fee >= 0) not valid;
alter table public.customers drop constraint if exists customer_text_lengths;
alter table public.customers add constraint customer_text_lengths check (char_length(name) between 1 and 160 and char_length(coalesce(phone,'')) <= 30 and char_length(coalesce(address,'')) <= 500 and char_length(coalesce(notes,'')) <= 2000) not valid;
alter table public.withdrawal_requests drop constraint if exists withdrawal_text_lengths;
alter table public.withdrawal_requests add constraint withdrawal_text_lengths check (char_length(bank_name) between 1 and 120 and char_length(bank_account_name) between 1 and 160 and char_length(bank_account_number) between 1 and 80 and char_length(coalesce(admin_notes,'')) <= 1000) not valid;
alter table public.topup_requests drop constraint if exists topup_text_lengths;
alter table public.topup_requests add constraint topup_text_lengths check (char_length(coalesce(reference_number,'')) <= 120 and char_length(proof_url) <= 500 and char_length(coalesce(admin_notes,'')) <= 1000) not valid;
