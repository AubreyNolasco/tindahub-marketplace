-- One-time cleanup: reseller@gmail.com is no longer needed as a hardcoded
-- test account. Real admin testing/demo access already happens through
-- nolascoaubrey@gmail.com's full-access admin account, so this account and
-- its data (wallet, etc.) are removed outright rather than kept banned.
-- merchant@gmail.com had already been deleted previously.
--
-- Deleting the auth.users row cascades through Supabase's own auth schema
-- (identities, sessions, ...) and, via public.profiles(id) references
-- auth.users(id) on delete cascade, through every dependent public table
-- (wallets, etc.) as well. Verified beforehand that no non-cascading
-- foreign key (reviewer/actor columns) referenced this user.

delete from auth.users where lower(email) = 'reseller@gmail.com';

notify pgrst, 'reload schema';
