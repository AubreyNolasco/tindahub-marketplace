# JOM HUB — Instructions for Claude (or any AI contributor)

This file is the entry point. Read this first, then the other four files in this folder as needed for the task at hand.

## Source of Truth

1. **`PROJECT_ARCHITECTURE.md`** is the official architecture. It was given directly by the project owner and takes precedence over any inference from code, any prior AI-written summary, or this file.
2. If existing code conflicts with `PROJECT_ARCHITECTURE.md` or `BUSINESS_RULES.md`:
   - **Do NOT immediately change the code.**
   - Analyze the conflict.
   - Explain the impact.
   - Recommend the safest solution.
   - Wait for approval (unless the owner has explicitly told you, for the current task, to proceed without stopping for approval — that instruction applies only to the task it was given for, not as a standing override of this rule).
3. **Never assume. Never rewrite. Always preserve existing business logic.**

## Existing Project Overview

- **Product:** JOM HUB — a Filipino B2B/B2C marketplace connecting Merchants, Resellers, and their Customers, with Admin oversight. See `PROJECT_ARCHITECTURE.md` for the module breakdown.
- **Stack:** React + Vite frontend (`ecommerce-platform/`), Supabase (Postgres + Auth + Storage + Edge Functions/Deno + Vault) as the entire backend, deployed to Vercel (auto-deploy on push to `main`), GitHub Actions CI.
- **Auth:** OTP email-code sign-in, no passwords.
- **Money:** internal wallet system (top-ups, service fees, escrow-style order debits/credits) — see `BUSINESS_RULES.md`.
- **Work history:** `TASK1.md` through `TASK6.md` at the repo root are the real, chronological record of what's been built, found, and fixed — read the relevant one before touching an area it covers (e.g. `TASK6.md` for the campaign/promotion system) instead of re-deriving context from scratch.
- **This folder (`TASK7/`)** exists because the owner asked for the architecture/business/UI/marketplace rules to be written down once, in one place, instead of living only in chat history.

## How to work on this project

1. **Analyze first.** Read the relevant existing tables, RPCs, components, and the applicable `TASKn.md` before proposing or writing anything.
2. **Follow `BUSINESS_RULES.md`'s Non-Destructive Development Policy** — reuse before creating, additive not destructive, no silent rewrites, backward compatible, forward-only migrations.
3. **Follow `UI_UX_GUIDELINES.md`** for anything user-facing — reuse `src/components/ui/*`, match existing design tokens and responsive patterns, don't invent a second visual language for one page.
4. **Follow `MARKETPLACE_SPEC.md`'s API/Security/Performance rules** — RPC-only for privileged writes, RLS on every table, batch reads, index what needs indexing.
5. **Test live, not just "the build passed."** Use the deployed site and the existing Admin Demo Merchant account where a real Merchant/Reseller flow needs exercising; clean up any test data afterward. See `MARKETPLACE_SPEC.md`'s Testing Rules and `TASK6.md`'s Phase 2/7/11 write-ups for the reference pattern (including two real bugs that were only caught this way).
6. **Document the outcome** in the relevant `TASKn.md` (or a new `TASKn.md` for a new major effort) — what was built, what was found, current true status. Don't leave the tracker aspirational or stale.
7. **When asked to move fast / stop asking for approval:** that permission is scoped to the specific task it was given for. It does not relax the Non-Destructive Development Policy, RLS/security rules, or the requirement to test before calling something done — it only means: don't pause between phases waiting for a go-ahead that's already been given.

## Acceptance bar

Before considering any change finished, it should satisfy `MARKETPLACE_SPEC.md`'s Acceptance Criteria checklist. If it doesn't, it isn't done yet — regardless of how much of the requested feature exists.
