# Tasks for Blackbox — split from Claude's current work

**Update 2026-08-07 (later same day): all three tasks below were completed by Claude directly** (owner asked Claude to take these over rather than wait, since no `blackboxai/...` branch for any of them existed yet). Nothing left here for Blackbox to pick up — see commit history on `main` from this point forward (`fix: root-cause and close the recurring demo-mode stuck-account incident`, `fix: force staff/admin write-attribution columns to auth.uid()`, `fix: mobile-responsive pass on Vouchers/CampaignPerformanceReport pages`) for what was done and why. Left the rest of this file as-is below for the record.

Written by Claude on 2026-08-07 so Claude and Blackbox can work in parallel on this repo without colliding. Blackbox has a usage limit, so every task below is scoped to be self-contained — no need to read `TASK6.md`/`TASK7/`/`TASKS.md` in full first, the context you need is inline here.

## Ground rules (read first)

- **Work on your own branch**, prefixed `blackboxai/...` (matches your own existing branches in this repo: `blackboxai/frontpage-background-images`, `blackboxai/system-improvements`) — one branch per task below, or one branch for all three if that's easier. Don't push directly to `main`. Claude is committing directly to `main` in parallel this session; a shared branch would conflict.
- **Do not touch these** — Claude is actively working in them today (2026-08-07) and merge conflicts here are the one thing to avoid: `TASK6.md`, `TASK7/*`, `TASKS.md`, anything under `ecommerce-platform/supabase/migrations/2026080[67]*.sql`, `src/pages/Admin/Vouchers.jsx`, `src/pages/Merchant/Vouchers.jsx`, `src/pages/Admin/Reports/CampaignPerformanceReport.jsx`, `src/pages/Admin/Campaigns.jsx`, `src/pages/Reseller/Checkout.jsx`, `src/components/notifications/RoleNotifications.jsx`.
- **This project's standing rules apply to you too** — read `TASK7/CLAUDE_INSTRUCTIONS.md` and `TASK7/BUSINESS_RULES.md` before writing code if you have budget for it; if not, the short version: reuse existing components/RPCs/patterns before adding new ones, RLS on every table, money/stock writes only through `security definer` RPCs, migrations are additive and forward-only (never edit an already-applied migration file — new file, new timestamp, even for a one-line fix), and don't change existing behavior for existing users as a side effect.
- When a task is done, leave it on its branch — don't merge to `main` yourself. Either open a PR or tell the owner it's ready; Claude or the owner will review and merge.
- If you run out of budget partway through a task, commit what you have with a clear message saying what's done vs. not, rather than leaving uncommitted work.

---

## Task 1 — Root-cause the recurring demo-account role-switch incident

**Why:** The same account has gotten stuck mid-way through "Reseller Mode (Admin demo)" and failed to return to admin role **three separate times** now (documented in `TASK6.md`'s Phase 8/9 incident note, and again in the Phase 12 write-up). Each time it was safely restored (`role = previous_role, previous_role = null`, since `previous_role` stayed intact), but nobody has actually looked at *why* the "Back to Admin" step keeps failing to complete. Three recurrences of the same incident is a pattern, not bad luck.

**Where to look:**
- `ecommerce-platform/supabase/migrations/20260729000600_admin_demo_role_switch.sql` — original `switch_role_for_demo()`/`switch_back_to_admin()` RPCs.
- `ecommerce-platform/supabase/migrations/20260729000700_fix_demo_role_switch_order.sql` and `20260729000800_demo_switch_trigger_bypass_flag.sql` — two follow-up fixes already applied to this same flow; read these to understand what's already been tried.
- Whatever frontend component calls `switch_role_for_demo()`/`switch_back_to_admin()` — grep the frontend for those RPC names to find it (likely somewhere in the Admin layout/account menu).

**What to find:** Is there a path where a user can navigate away, close the tab, get a network error, or otherwise leave the app *after* `switch_role_for_demo()` succeeds but *before* `switch_back_to_admin()` is called or completes? If so, that's the root cause. Look for:
- Whether "Back to Admin" is a single click calling one RPC, or a multi-step flow that can be interrupted partway.
- Whether there's any safeguard today for an account stuck in demo mode for too long (there isn't, as far as Claude found — confirm this).

**What to build:** Your call once you've seen the actual flow, but candidates:
- A guard so the demo-mode UI is impossible to navigate away from without confirming ("Back to Admin" as a persistent banner that follows the user everywhere while in demo mode, not just on one page).
- A safety net: a scheduled job (this app already uses `pg_cron` — see `run_operational_maintenance()` or `run_campaign_scheduler()` as reference patterns) that auto-reverts any account that's been sitting with a non-null `previous_role` for longer than, say, 1 hour, back to `previous_role`. This is probably the more robust fix — closes the gap regardless of *how* the user got stuck.
- Explain your finding and proposed fix before writing it if you're not confident it's the actual root cause — this flow moves who-has-admin-access, so a wrong guess here is worse than no fix.

**Done when:** root cause identified and explained, a fix is implemented and deployed (`supabase db push`) or a migration file is ready for someone with deploy access to push, and you've noted in your commit message what you found.

---

## Task 2 — Minor audit-trail gap: staff writes don't force `created_by`/`reviewed_by` to themselves

**Why:** Found during a security audit sweep on 2026-08-07 (see `TASKS.md`'s "Security audit sweep" entry for full detail — don't need to read the whole file, just this: the audit was checking for privilege-escalation bugs, and this one **is not** a privilege escalation, it's just imprecise recordkeeping). Several `staff_*_manage` RLS policies (the ones gating `staff_access`-permissioned staff members, not full admins) are `for all using (has_admin_permission('x'))` with no `WITH CHECK` forcing `created_by`/`reviewed_by`-style columns to the actual caller. A staff member already has full access to that resource once granted the permission — they're not gaining any *new* capability — but they could currently insert/update a row and set its "who did this" column to any arbitrary profile id instead of their own, which would misattribute authorship in an audit log or approval trail.

**Where to look:** grep `pg_policies` (or the source migrations) for `has_admin_permission(` policies on: `campaigns` (`staff_campaigns_manage`), `topup_requests` (`staff_topups_manage`), `withdrawal_requests` (`staff_withdrawals_manage`), `site_settings` (`staff_homepage_manage`), `registration_appointments` (`staff_registrations_manage`), `subscription_requests` (`staff_subscription_requests_manage`), `payments` (`staff_payments_manage`). For each, find the relevant "who did this" column (`created_by`, `reviewed_by`, `updated_by`, etc. — varies per table, check each table's schema) and check whether the RPC/frontend flow that writes it already sets it correctly in practice (it might! this may be a defense-in-depth gap that's never actually hit in real usage, same shape as the vouchers bug before it was fixed) or whether a raw client `.update()`/`.insert()` could set it to something else.

**What to build:** For each table where it's a real gap (client could set the field to an arbitrary value), either (a) add a `WITH CHECK` clause forcing the column to `auth.uid()` — cheapest fix, mirrors how `campaigns_admin_manage` already does `with_check = is_admin() and created_by = auth.uid()` for the full-admin policy on the same table, or (b) if the column is set server-side by a trigger already (check first), no fix needed — just note that in your writeup. Don't force-fix columns that don't need it.

**Done when:** every table listed has been checked, real gaps have a `WITH CHECK` added (new migration file, e.g. `ecommerce-platform/supabase/migrations/2026080X..._staff_writer_attribution.sql`), and your commit/PR notes which tables needed a fix vs. which were already fine.

---

## Task 3 — Mobile-responsiveness pass on the 3 newest Admin/Merchant pages

**Why:** `TASK7/UI_UX_GUIDELINES.md` requires every new page to be checked at mobile width before it's considered done ("not just desktop with a mobile 'pass' bolted on"). The three pages below were built today and haven't had this pass yet.

**Files (read-only reference, don't edit these three — Claude is still actively touching them; instead, note what you'd change and either wait or ask before editing):**
- `ecommerce-platform/src/pages/Admin/Vouchers.jsx`
- `ecommerce-platform/src/pages/Merchant/Vouchers.jsx`
- `ecommerce-platform/src/pages/Admin/Reports/CampaignPerformanceReport.jsx`

**What to actually do instead**, so this doesn't collide with Claude's files: run the app locally (`npm run dev` inside `ecommerce-platform/`), open each of the three pages at a narrow viewport (375px-ish, e.g. Chrome DevTools device toolbar), and write up **findings only** (no edits) in a new file `TASKBLACKBOX_MOBILE_FINDINGS.md` at the repo root: what overflows, what needs `truncate`/`line-clamp-*`, what's cramped, whether the `xl:grid-cols-[380px_1fr]` two-column layout on the Vouchers pages degrades sensibly at narrow width, whether the `DataTable` inside each is usable on a phone. Reference `TASK7/UI_UX_GUIDELINES.md`'s Responsive Requirements section for what "done" looks like. Claude (or the owner) will apply the actual fixes to avoid a merge conflict on files still being edited today.

**Done when:** `TASKBLACKBOX_MOBILE_FINDINGS.md` exists with concrete, actionable findings per page (not just "looks fine" — specific issues or explicitly "no issues found" per page).
