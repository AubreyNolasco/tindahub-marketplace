# JOM HUB — Change Log

A running record of notable platform changes, newest first. This starts from the project's git history — for full commit-level detail, see `git log`.

## 2026-08-05

- **UI/UX consistency pass**: shared `Tabs`, `Switch`, and extended `Modal`/`Button`/`DataTable` components rolled out across Admin, Reseller, and Merchant pages, replacing hand-duplicated markup with one consistent, accessible implementation — no workflow or business-logic changes.
- Added `aria-label` to every icon-only button that previously had no accessible name (18 across Admin/Reseller/Merchant).
- Dashboard stat cards now show a real loading skeleton instead of a literal "—" while data loads.
- Fixed tablet-width (`md:`) layout gaps: dashboard stat grids were stuck at 2 columns from 640px to nearly 1280px; the Reseller storefront product grid actually *lost* a column at tablet width before regaining it.
- Removed a duplicate "Real Estate Referral" homepage section (the feature itself — real-estate referral services — is real and unaffected; only the redundant duplicate marketing block was removed).
- JOM Bits now answers in whichever language it's asked in (Tagalog or English) even when running in offline/non-AI fallback mode, not just in AI mode.
- Switched JOM Bits' AI provider to Groq and broadened its offline knowledge coverage; fixed a keyword false-positive that misrouted delivery questions to product-listing answers.
- Wired up Google Gemini, then switched to Groq, as JOM Bits' AI answer engine (fourth real third-party integration).
- Replaced free-text province/city/barangay address fields with official PSGC (Philippine Standard Geographic Code) cascading dropdowns across every address form in the system.
- Switched address map autocomplete from Google Maps to LocationIQ (a free provider) after modernizing address entry into structured fields.
- Wired up Semaphore SMS notifications (third real integration).
- Fixed a CORS configuration gap that silently blocked browser-invoked Edge Function calls missing the `x-client-info` header, across every affected function.

## 2026-08-04

- Wired up Google Vision OCR for automated business-permit review assistance (second real integration; advisory only — a human reviewer still approves or rejects).
- Wired up PayMongo for online wallet top-ups (first real payment adapter).
- Added Top Performers leaderboards (top product/reseller/merchant) to the Admin dashboard, with a date-range filter.
- General integration scaffolding, lint cleanups, lazy-loaded routes, and CI pipeline setup (`npm ci && npm test && npm run build && npx eslint .` on every push).

## 2026-08-01

- Added a multi-provider delivery engine and refactored the homepage into a single header navigation.
- Added an account dropdown to the header for quick access to Dashboard/Products/Services when logged in.
- Fixed a device-approval lockout affecting Reseller/Merchant accounts after a PC restart.

## 2026-07-29 to 2026-07-31

- Added a Lalamove delivery booking pipeline for Resellers.
- Added a premium design system foundation and redesigned the three role dashboards (Admin, Merchant, Reseller).
- Added a free 6-month Merchant subscription with automatic dashboard lockout on expiry.
- Added Admin ↔ Merchant/Reseller support chat, with notifications, emoji reactions, and an emoji picker.
- Added admin tools for previewing Reseller/Merchant dashboards and a full admin demo mode for both workspaces.
- Added real enable/disable control for test accounts.
- General front-page UI/UX improvements and new landing pages/sub-navigation.

## 2026-07-24 to 2026-07-27

- Added clinic and real-estate referral services, Reseller customer storefronts, device/MFA security, and related admin tooling.
- Added permit-expiry tracking, admin-created accounts, and initial Reseller wallet credit.
- Rewrote the homepage in English with authentic Filipino imagery; added background images to key homepage sections.
- Added tester auto sign-in links for easier demo access.
- Added post-login onboarding guide and reliable login-history tracking.

## 2026-07-22 — Initial feature set

- Secure Gmail email-OTP login.
- Admin product upload management and one-click sample catalog.
- Secure product-posting restrictions (screening for prohibited listings).
- Reusable InstaPay QR payment destination for wallet top-ups.
- Reseller per-piece and bulk profit calculator.
- Role-aware JOM Bits system assistant (offline/knowledge-based mode).
- Role notifications, page walkthroughs, and realtime admin request notifications.
- Payout destinations and optional store hours.
- Duration-based report exports.
- Separate professional training presentations for Admin/Merchant/Reseller.
- JOM HUB branding applied to the admin workspace.
