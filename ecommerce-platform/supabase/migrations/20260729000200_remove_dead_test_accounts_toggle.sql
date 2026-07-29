-- The reseller@gmail.com / merchant@gmail.com test accounts were already
-- permanently disabled by 20260723002700_production_security_hardening.sql
-- (banned_until = infinity at the auth.users level) and their auto-approval
-- / free-wallet backdoor was removed the same day by
-- 20260723002800_remove_test_account_privilege_backdoor.sql.
--
-- The "enable/disable" toggle added four days later in
-- 20260727000100_test_accounts_toggle.sql never touched either of those —
-- it only flipped a site_settings flag. Flipping it to "enabled" gave the
-- false impression the accounts became usable again; they never did. Since
-- nothing in the app depends on real toggling behavior, remove the dead
-- RPCs and the setting row instead of leaving a control that lies about
-- what it does.

drop function if exists public.toggle_test_accounts(boolean);
drop function if exists public.get_test_accounts_status();

delete from public.site_settings where key = 'test_accounts';

notify pgrst, 'reload schema';
