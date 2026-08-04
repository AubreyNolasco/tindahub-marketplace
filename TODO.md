# Dashboard Enhancement — TODO

## Tasks
- [x] Create Supabase migration `20260805000200_dashboard_leaderboards.sql` with RPCs:
  - get_top_product()
  - get_top_reseller()
  - get_top_merchant()
- [x] Create service file `src/lib/services/dashboardStats.js` calling the RPCs
- [x] Create component `src/components/dashboard/LeaderboardCard.jsx`
- [x] Modify `src/pages/Admin/AdminDashboard.jsx` to add the three leaderboard cards
- [x] Build to verify no errors (`npm run build`)
</content>
