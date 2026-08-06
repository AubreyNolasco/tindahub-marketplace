# Sidebar Redesign + Storefront Fixes — Progress & Handoff

Tracker for this request: redesign the Admin/Reseller/Merchant sidebars (alphabetical within groups, add an in-sidebar search box, merge nav items that belong together, modern 2026 visual design, fully responsive), fix the Reseller onboarding guide popup incorrectly appearing on the public customer-facing storefront link, and modernize the customer-facing storefront page itself.

**After every batch**: `npm run build && npx eslint . && npm test`, commit, push, `gh run watch` for CI green, then verify live via Chrome automation.

## 🔧 Batches — in order

- [x] **Batch 1 — Fix onboarding guide popup leaking onto public pages.** `PostLoginGuide.jsx` rendered globally on every route with only `/auth/callback` and `/device-access` excluded — so any logged-in user (most commonly a Reseller previewing their own share link) would see their own "Reseller next steps / Prepare your first sale" dashboard-onboarding popup layered on top of the public storefront a customer is meant to see cleanly. Added a public-path exclusion (`/store/:slug`, `/reseller-store/:id`, `/merchant-store/:id`, `/`, `/policy`, `/legal/:type`) so the guide never fires there regardless of who's logged in.
- [ ] **Batch 2 — Redesign Admin/Reseller/Merchant sidebars.** Alphabetize nav items within each group (dashboard/"Overview" pinned first as the one deliberate exception), add real section grouping where still flat, add a live-filter search input inside the sidebar itself (not just the existing Cmd+K command palette), merge/dedupe nav entries that overlap, modern 2026 visual pass, confirm responsive at mobile/tablet/desktop.
- [ ] **Batch 3 — Modernize the customer-facing storefront page.** `ResellerStorefront.jsx` — modern 2026 visual redesign focused on customer experience, fully responsive across devices. Keep the underlying ordering flow (product popup → order form → confirmation) from TASK3 unchanged, this is a visual/UX pass on top of it.

## Notes for whoever picks this up next

- This session's earlier TASK3.md (customer storefront ordering) is what built `ResellerStorefront.jsx`'s current ordering flow and the `Reseller Customer Orders` inbox — read that first for how ordering actually works before changing storefront markup.
- The Admin sidebar (`AdminLayout.jsx`) is self-contained; the Reseller and Merchant sidebars both go through the shared `WorkspaceLayout.jsx` component — a fix/feature added to `WorkspaceLayout.jsx` (like the in-sidebar search) automatically applies to both Reseller and Merchant, so prefer editing there over duplicating logic into each layout file.
- `PostLoginGuide.jsx`'s new `isPublicPath()` allowlist-of-exclusions approach should be extended (not replaced) if more public-facing routes are added later.
