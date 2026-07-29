-- Both hardcoded test accounts (merchant@gmail.com, reseller@gmail.com) are
-- gone now -- merchant@gmail.com was already absent, and
-- 20260729000400_delete_reseller_test_account.sql removed reseller@gmail.com.
-- Nothing in the app calls these ban-toggle RPCs anymore, so drop them
-- rather than leave admin-callable functions that reference emails that no
-- longer exist.

drop function if exists public.get_test_accounts_ban_status();
drop function if exists public.set_test_account_banned(text, boolean);

notify pgrst, 'reload schema';
