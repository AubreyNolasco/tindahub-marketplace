# JOM HUB — UI/UX & Responsive Guidelines

Design conventions actually in use across `ecommerce-platform/src/`, kept as one reference so new screens stay visually consistent instead of each page inventing its own button/card/badge style.

## UI/UX Requirements

- **Component reuse first.** Before writing new markup, check `src/components/ui/` (`Button`, `Badge`, `Tabs`, `DataTable`, `EmptyState`, `Spinner`, `AddressFields`, `SearchableSelect`, etc.) and the category component folders (`components/product/`, `components/wallet/`, `components/reports/`). A new page's "Approve/Reject" buttons, empty states, tab strips, and tables should look identical to every other page's, because they're the same components.
- **Design tokens, not hardcoded colors.** Use the existing Tailwind design tokens (`text-ink`, `text-ink/60`, `bg-surface`, `bg-surface-inset`, `border-black/[0.06]`, brand colors `teal-*`/`mango-*`/`coral-*`) rather than arbitrary hex values, so dark mode (`dark:` variants already wired throughout) keeps working automatically.
- **Toasts for feedback, not custom modals.** Success/error feedback uses `react-hot-toast` (`toast.success(...)`/`toast.error(...)`) exactly like the rest of the app — consistent timing and placement.
- **Status → color mapping is consistent app-wide.** Green/teal = approved/success/active, amber/mango = pending/warning, red/coral = rejected/danger, neutral gray = draft/archived/inactive. Reuse `Badge`'s `tone` prop rather than inventing new color combinations per page.
- **Icons from `lucide-react` only** — matches every existing screen; don't introduce a second icon library.
- **2026-modern, not dated-admin-template.** Rounded-2xl cards, soft shadows (`shadow-soft`), generous whitespace, gradient accents used sparingly for emphasis (campaign cards, hero banners) — not dense 2010s-era admin-panel tables everywhere.

## Responsive Requirements

- **Mobile-first, every screen.** Every new page/component must be checked at mobile width before considered done — not just desktop with a mobile "pass" bolted on.
- **Fluid layout over fixed breakpoints.** Prefer CSS Grid `auto-fit`/`minmax()` for card grids (this is the established fix for the brittle flex-row/breakpoint-jump pattern that used to cause ugly text wrapping at narrow widths — see `TASK4.md`) over hardcoded `grid-cols-N` that only works at one width.
- **Sidebar navigation collapses on small screens** — the existing `SidebarNav` component already handles this; new dashboard pages go *inside* the existing layout shells (`AdminLayout`, `MerchantLayout`, Reseller equivalent), they don't build their own page chrome.
- **Text must not overflow or clip at narrow widths** — long product names, campaign names, business names need `truncate`/`line-clamp-*` or wrapping, verified at mobile width, not just assumed to fit.
- **Touch targets** on mobile are sized for fingers, not mouse pointers — buttons/links in dense list rows keep adequate padding at small breakpoints even when the layout tightens.
- **Diagrams/flowcharts get their own responsive treatment** — the System Flowchart pages (`Admin/SystemFlowchart.jsx`, `FullSystemFlowchart.jsx`) are the reference example of a complex visual that had to be explicitly reworked for narrow screens (see `TASK4.md`); any new diagram-style UI should follow that same approach (scrollable container, resized text/nodes at breakpoints) rather than shrinking an SVG until it's unreadable.

## Sample Data Requirements

- Sample/seed/demo data is clearly labeled as such in its own name (e.g. the existing `SAMPLE_PRODUCTS` seeding flow in `Merchant/Products.jsx`, the "Admin Demo Merchant" account, `TEST ...` prefixes used during live QA in `TASK6.md`) — never indistinguishable from real merchant/customer data.
- Demo/test data created for a feature's own QA (see the "Admin Demo Merchant" testing pattern in `TASK6.md`) is cleaned up (deleted) once verification is done, unless it's an intentionally-persistent seed (like the recurring calendar campaigns or the sample product catalog), which stays clearly named as such.
- Never use real user PII in checked-in sample/seed data or in documentation examples.
