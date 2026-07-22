-- ONE-TIME PRODUCTION LAUNCH CLEANUP
--
-- Preserves:
--   * every account whose public.profiles.role = 'admin'
--   * merchant@gmail.com
--   * reseller@gmail.com
--   * categories, homepage settings, shipping settings, and schema objects
--
-- Removes operational/demo records and every other Auth account.
-- Kept-account wallet balances are reset to zero.
--
-- Run only in the intended Supabase project via SQL Editor.

begin;

do $$
declare
  v_admin_count integer;
  v_test_count integer;
begin
  select count(*) into v_admin_count
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.role = 'admin';

  select count(*) into v_test_count
  from auth.users
  where lower(email) in ('merchant@gmail.com', 'reseller@gmail.com');

  if v_admin_count < 1 then
    raise exception 'Cleanup aborted: no admin account was found.';
  end if;

  if v_test_count <> 2 then
    raise exception 'Cleanup aborted: both tester accounts must exist before cleanup.';
  end if;
end;
$$;

-- Transactional and communication data, children before parents.
delete from public.product_reviews;
delete from public.chat_messages;
delete from public.payments;
delete from public.order_items;
delete from public.shipping_distance_quotes;
delete from public.orders;
delete from public.customers;

-- Catalog/demo inventory. Categories are intentionally retained.
delete from public.merchant_campaigns;
delete from public.products;
delete from public.campaigns;

-- Payment, wallet, approval, and audit history.
delete from public.platform_wallet_transactions;
delete from public.wallet_transactions;
delete from public.topup_requests;
delete from public.withdrawal_requests;
delete from public.subscription_requests;
delete from public.registration_appointments;
delete from public.login_history;

-- Remove all non-admin/non-tester identities. profiles and their owned rows
-- cascade through the foreign keys defined by the application schema.
delete from auth.users u
where lower(coalesce(u.email, '')) not in ('merchant@gmail.com', 'reseller@gmail.com')
  and not exists (
    select 1 from public.profiles p
    where p.id = u.id and p.role = 'admin'
  );

-- Keep the launch accounts usable while removing demo balances/history.
update public.wallets
set balance = 0,
    updated_at = now()
where owner_id in (
  select u.id
  from auth.users u
  left join public.profiles p on p.id = u.id
  where p.role = 'admin'
     or lower(u.email) in ('merchant@gmail.com', 'reseller@gmail.com')
);

update public.platform_wallet
set balance = 0,
    updated_at = now()
where id = true;

-- Final safety assertions. Any failure rolls back the entire cleanup.
do $$
declare
  v_admin_count integer;
  v_test_count integer;
  v_non_preserved integer;
begin
  select count(*) into v_admin_count
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.role = 'admin';

  select count(*) into v_test_count
  from auth.users
  where lower(email) in ('merchant@gmail.com', 'reseller@gmail.com');

  select count(*) into v_non_preserved
  from auth.users u
  left join public.profiles p on p.id = u.id
  where lower(coalesce(u.email, '')) not in ('merchant@gmail.com', 'reseller@gmail.com')
    and p.role is distinct from 'admin';

  if v_admin_count < 1 or v_test_count <> 2 then
    raise exception 'Cleanup rolled back: a protected account is missing.';
  end if;

  if v_non_preserved <> 0 then
    raise exception 'Cleanup rolled back: non-preserved accounts remain.';
  end if;
end;
$$;

commit;

-- Expected result: only admins plus merchant@gmail.com and
-- reseller@gmail.com remain. Run this read-only verification afterward:
-- select u.email, p.role, w.balance
-- from auth.users u
-- left join public.profiles p on p.id = u.id
-- left join public.wallets w on w.owner_id = u.id
-- order by p.role, u.email;
