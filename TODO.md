# Dashboard Enhancement — TODO

## Tasks
- [x] Create Supabase migration `20260805000200_dashboard_leaderboards.sql` with RPCs:
  - get_top_product(p_start_date, p_end_date)
  - get_top_reseller(p_start_date, p_end_date)
  - get_top_merchant(p_start_date, p_end_date)
- [x] Create service file `src/lib/services/dashboardStats.js` calling the RPCs
- [x] Create component `src/components/dashboard/LeaderboardCard.jsx`
- [x] Modify `src/pages/Admin/AdminDashboard.jsx` to add the three leaderboard cards
- [x] Add date-range picker (preset periods + custom start/end) to the leaderboard section
- [x] Build to verify no errors (`npm run build`)
- [x] Apply pending migrations to the linked Supabase database (`supabase db push`)

## Notes
- The migration originally left a stray zero-argument `get_top_product()` (etc.)
  on production alongside the new `(date, date)` overload, which made PostgREST
  fail with "Could not choose the best candidate function." Fixed by adding
  `drop function if exists` for the zero-arg signature before recreating it.
- Pushing also surfaced an unrelated break in `20260805000100_fix_staff_access.sql`:
  its `get_admin_merchant_profiles()` dropped the `business_permit_expires_at`
  column that production already had and `Admin/Merchants.jsx` reads, which
  `CREATE OR REPLACE FUNCTION` can't do. Fixed by dropping the function first
  and restoring the column.
- Both migrations are now applied and in sync with remote (`supabase migration list`).
- Fixed a stale-closure bug in `AdminDashboard.jsx`: the date-range dropdown
  called `setLeaderboardStart`/`setLeaderboardEnd` then `load()` in the same
  handler, but `load()` closed over the pre-update state, so switching periods
  fetched with the *previous* range. Leaderboard fetching is now its own
  `loadLeaderboards(start, end)` that takes the range as arguments instead of
  reading it from closure, and callers pass the freshly computed range directly.
