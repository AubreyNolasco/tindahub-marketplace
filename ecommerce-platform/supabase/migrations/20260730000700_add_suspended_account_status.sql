-- Reseller doesn't have a ban/suspend option today -- profiles.account_status
-- only supports pending/approved/rejected. Adding 'suspended' so Admin can
-- ban a Reseller account the same way merchant_profiles.status already
-- supports for Merchants. New enum values can't be referenced in the same
-- transaction they're added in, so this is its own migration, applied
-- before the follow-up migration that actually uses it.

alter type public.account_status add value if not exists 'suspended';
