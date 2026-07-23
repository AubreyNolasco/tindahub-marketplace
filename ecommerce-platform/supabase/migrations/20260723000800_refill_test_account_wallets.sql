-- The two internal test accounts (reseller@gmail.com, merchant@gmail.com) are
-- meant to always have testing funds per test_account_auth_setup.sql, but
-- that trigger only fires on first signup. Their wallets had been drawn down
-- by prior test orders. Restore the standing test balance.
update public.wallets w
set balance = 10000000, updated_at = now()
from public.profiles p
where w.owner_id = p.id
  and lower(p.email) in ('reseller@gmail.com', 'merchant@gmail.com');
