# JOM HUB — B2B Marketplace

JOM HUB is a role-based marketplace for Merchants, Resellers, Admin, and limited-access staff. It uses React, Vite, Tailwind CSS, Supabase, and Vercel.

## Current workflow

- Email OTP authentication and role onboarding
- Merchant permit, subscription payment, and unified Admin activation
- Reseller initial wallet top-up and Admin review
- Reseller-curated customer storefronts with unique store-name links, profile/cover media, and optional contact channels
- Logged-in-only marketplace discovery; customer storefronts expose only the Reseller's selected products
- Merchant/Admin product publishing with safety screening and pricing controls
- Server-verified wallet checkout with a capped 1% Reseller system fee
- 3% Merchant success fee on completed product orders only
- Courier, tracking, delivery schedule, actual fee, and private dispatch proof
- Protected seven-day delivery completion with dispute pause
- Cancellation, dispute, return, replacement, and refund case records
- Customer payment tracking with projected and realized Reseller margins
- Wallet withdrawals with limits, payout cooldown, schedule, reference, and proof
- Reports, notifications, role guides, Admin presentations, and legal policies

## Local setup

1. Install the current Node.js LTS release.
2. Copy `.env.example` to `.env`.
3. Set the Supabase project URL and public anonymous key in `.env`.
4. Install and run:

```powershell
npm install
npm run dev
```

The local site is normally available at `http://localhost:5173`.

## Verification

Run these before release:

```powershell
npm test
npm run build
```

## Database migrations

The linked production project uses the ordered files in `supabase/migrations`. Do not rerun legacy standalone SQL scripts against production because some of them describe older fee or checkout models.

```powershell
npx supabase db push --dry-run
npx supabase db push
```

Never run reset or cleanup SQL against production. Never expose the Supabase service-role key in frontend environment variables.

## Production

- Website: https://tindahub-marketplace.vercel.app
- Repository: https://github.com/AubreyNolasco/tindahub-marketplace
- Support: nolascoaubrey32@gmail.com

The existing project and repository URLs retain their original technical names; all customer-facing branding is JOM HUB.
