# System Improvement Plan - TODO

## Step 1: Database Migration - Fix Merchants & Permits
- [x] Create `20260724000100_system_improvements.sql` with:
  - Add `business_permit_expires_at` column to `merchant_profiles`
  - Fix `activate_account_invitation()` - admin-created merchants get approved + subscription
  - Fix `activate_existing_account_invitation()` - same as above
  - Fix `enforce_merchant_permit_approval()` - allow admin bypass
  - Give admin-created resellers ₱500 initial wallet
  - Add maintenance function `expire_business_permits()`
  - Update `get_admin_merchant_profiles` to include `business_permit_expires_at`
  - Update `get_my_merchant_profile` to include `business_permit_expires_at`

## Step 2: Fix BusinessPermit.jsx
- [x] Add `status: 'pending'` on resubmission
- [x] Show expiry date info when permit is approved
- [x] Better error handling with bucket detection

## Step 3: Fix Admin Merchants.jsx
- [x] Add expiry date picker modal when approving a permit
- [x] Show permit expiry info (valid until/expired) on merchant cards

## Step 4: Admin FullAccess.jsx (No changes needed - already has create form)
- [x] Migration handles admin-created accounts (merchant fully activated, reseller gets ₱500)

## Step 5: ResellerDashboard.jsx (No changes needed - ₱500 wallet satisfies the > 0 check)
- [x] Admin-created resellers skip "Fund wallet" step naturally since they get ₱500

## Step 6: Verify all files are properly saved
- [x] Migration file complete
- [x] BusinessPermit.jsx complete
- [x] Merchants.jsx complete

