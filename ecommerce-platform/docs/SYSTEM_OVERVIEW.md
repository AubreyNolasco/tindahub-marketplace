# JOM HUB — System Overview

JOM HUB is a role-based B2B marketplace built for Filipino Merchants and Resellers. It connects product suppliers (Merchants) with resellers who buy in bulk or per piece and sell on to their own customers, with Admin oversight at every trust-sensitive step.

This document is the starting point for the rest of the docs set:

- **[User Manual](./USER_MANUAL.md)** — for Merchants and Resellers using the platform day to day.
- **[Admin Guide](./ADMIN_GUIDE.md)** — for Admin and Staff running platform operations.
- **[Troubleshooting Guide](./TROUBLESHOOTING.md)** — common problems and how to resolve them.
- **[FAQ](./FAQ.md)** — short answers to the questions people ask most.
- **[Change Log](./CHANGELOG.md)** — a running record of notable platform changes.

## Who uses JOM HUB

| Role | What they do |
|---|---|
| **Merchant** | Runs a digital storefront: lists products (or clinic/real-estate referral services), manages stock and pricing, fulfills orders, and receives payouts to their wallet. |
| **Reseller** | Discovers Merchant products, buys at wholesale or per-piece pricing, resells to their own customers (in person, via a personal storefront link, or through referral services), and manages their own wallet and customer list. |
| **Admin** | Approves Merchant and Reseller applications, reviews payments (top-ups, subscriptions, withdrawals), resolves disputes, manages the platform wallet, and maintains homepage content and legal policies. |
| **Staff** | An Admin-invited account scoped to only the Admin Center modules they need (e.g. Finance, Merchant Review) — least-privilege access instead of a full Admin account. |

## How an account gets from signup to active

1. **Sign up** — email + 6-digit OTP (or Google sign-in), then choose Merchant or Reseller. The new account lands in its dashboard immediately; it can browse right away, but placing orders or posting products stays blocked until the required approvals below are complete.
2. **Merchant path** — submit a readable business permit and confirm the (free 6-month starter, or paid) subscription; Admin reviews the permit and the subscription payment separately, then activates the store. A Merchant can request temporary access from Admin while the permit is still under review.
3. **Reseller path** — verify identity and submit an initial wallet top-up; Admin reviews both, independently of each other, before the Reseller can place orders.
4. Once approved, both roles operate under a consistent set of protections: server-validated pricing and stock, escrow-style wallet holds, and a documented fulfillment/completion/dispute process (see the User Manual and Admin Guide for the full flow).

## Core marketplace mechanics

- **Wallet-based payments.** Resellers hold a wallet balance (topped up via JOM HUB's InstaPay QR, reviewed by Admin) and pay for orders out of it. Merchants receive payouts to their own wallet and can withdraw to their bank/e-wallet, subject to minimums, a daily limit, and a cooldown after changing payout details.
- **Server-verified checkout.** Every order re-quotes price, stock, account access, and wallet balance on the server at the moment of checkout — the price a Reseller sees is never trusted blindly from the client.
- **Fees.** A capped Reseller system fee (1% of product total, ₱3 minimum, ₱50 maximum per order) and a 3% Merchant success fee apply on completed product orders. Referral services (clinics, real estate) use a separate referral-fee model instead.
- **Protected fulfillment.** Orders move through a defined status flow (Confirmed → Processing → shipping-fee agreement → Shipped → Completed), with Merchant payout released only after delivery is confirmed or the automatic 7-day completion window passes without an open dispute.
- **Referral services.** A Merchant can also (or instead of) list itself as offering clinic or real-estate referral services. A Reseller refers a customer to that Merchant's service and earns a referral fee once the service is completed — no product inventory involved.
- **Reseller storefronts.** A Reseller can curate a subset of Merchant products into their own branded, shareable storefront page for their own customers to browse and request a purchase through.

## Technology (for anyone maintaining the system)

React + Vite + Tailwind CSS on the frontend, Supabase (Postgres, Edge Functions, Auth, Storage, Vault) on the backend, deployed on Vercel. See the repository [README](../README.md) for local setup and deployment commands, and the `*_SETUP.md` files in the repository root for how each third-party integration (PayMongo, Google Vision OCR, Semaphore SMS, LocationIQ, Groq) is wired up.
