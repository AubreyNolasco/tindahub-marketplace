# JOM HUB Authentication Setup

Login supports **two** methods today: Email OTP (the default, primary flow) and Google OAuth (secondary "Continue with Google" option). An earlier version of this doc described a Google-only design; email OTP was added afterward (see `supabase/email_magic_link_auth_migration.sql`, which is explicitly "provider-neutral profile creation... for email magic links, run after the existing Google/auth repair migrations").

## 1. Apply the database migrations

Run these in order via Supabase Dashboard → SQL Editor (or `supabase db push` once they're in `supabase/migrations/`):

1. `supabase/google_oauth_only_migration.sql` — Google identity fields, one-profile-per-user trigger, immutable identity protection, RLS, secure marketplace-onboarding RPC.
2. `supabase/email_magic_link_auth_migration.sql` — provider-neutral `handle_new_user()` trigger so email-OTP signups get the same `profiles`/`wallets` bootstrap as Google signups.
3. `supabase/test_account_auth_setup.sql` — allows two hardcoded test accounts (`reseller@gmail.com`, `merchant@gmail.com`) to sign in with a password instead of OTP/Google, for automated testing. Every other account must use Google or email OTP.

## 2. Configure the Google Cloud project

1. Open Google Cloud Console → Google Auth Platform.
2. Create or select the JOM HUB project.
3. Configure Branding with the JOM HUB application name, support email, and authorized domain used by the deployed site.
4. Configure Audience. Use External for public Google accounts. While the app is in Testing, add every Google account that will test it under Test users.
5. Open Clients → Create Client → Web application.
6. Add this exact Authorized redirect URI:

   `https://ttscpfsodrcyllyvvqzb.supabase.co/auth/v1/callback`

7. Save and securely copy the generated Client ID and Client Secret. Never put the Client Secret in this Vite project or in a `VITE_` environment variable.

## 3. Configure Supabase Auth

1. Open Supabase Dashboard → Authentication → Providers → Google.
2. Enable Google. Paste the Client ID and Client Secret, then save.
3. Open Authentication → Providers → Email. Keep it **enabled** — email OTP sign-in depends on it (the login page's default view is email, not Google). "Confirm email" / password sign-up should stay off; only OTP (magic code) is used, matching `signInWithOtp`/`verifyOtp` in `AuthContext.jsx`.
4. Open Authentication → URL Configuration.
   - Keep the production site as Site URL.
   - Add `http://127.0.0.1:5173/auth/callback` and `http://localhost:5173/auth/callback` to Redirect URLs for local testing.
   - Add the deployed HTTPS `/auth/callback` URL to Redirect URLs before production testing.
5. Do not enable any other social provider — Google and email OTP are the only two supported.

## 4. Environment configuration

The browser needs the project URL, anon key, and (optionally) a Turnstile site key for bot protection on the OTP request form:

```env
VITE_SUPABASE_URL=https://ttscpfsodrcyllyvvqzb.supabase.co
VITE_SUPABASE_ANON_KEY=use-the-existing-project-anon-or-publishable-key
VITE_TURNSTILE_SITE_KEY=
```

`VITE_TURNSTILE_SITE_KEY` is optional — when unset, `Login.jsx` skips rendering the captcha widget and the OTP request has no bot-check. The Google Client Secret and any Turnstile secret key belong only in Supabase Dashboard / server-side config. Neither must ever be stored in `.env`, frontend JavaScript, Git, or Vercel browser environment variables.

## 5. Local test flow

**Email OTP (default):**
1. Run `npm run dev -- --host 127.0.0.1`.
2. Open `http://127.0.0.1:5173/login`.
3. Enter an email address and submit — a 6-digit code is sent (expires in 10 minutes, single use).
4. Enter the code on the same page.
5. Confirm the app routes to `/auth/continue`, then `/onboarding` for a first-time user.

**Google OAuth (secondary):**
1. From `/login`, click **Continue with Google** below the "or" divider.
2. Confirm the browser opens Google's official account-selection/consent page.
3. Complete Google authentication.
4. Confirm the callback returns to `/auth/callback`, then `/auth/continue` → `/onboarding` for a first-time user.

Existing users of either method should go directly to the appropriate approval screen or dashboard instead of onboarding.

## Authentication file structure

```text
src/
├── components/
│   ├── auth/
│   │   ├── AuthShell.jsx
│   │   ├── ProfileLoadError.jsx
│   │   └── TurnstileWidget.jsx
│   ├── layout/
│   │   ├── Navbar.jsx
│   │   └── ProtectedRoute.jsx
│   └── ui/
│       └── Spinner.jsx
├── contexts/
│   └── AuthContext.jsx
├── lib/
│   └── supabase.js
├── pages/
│   ├── Auth/
│   │   ├── AuthCallback.jsx
│   │   ├── AuthContinue.jsx
│   │   ├── DeviceAccessAction.jsx
│   │   ├── Login.jsx
│   │   ├── Onboarding.jsx
│   │   ├── PendingApproval.jsx
│   │   └── ChooseSubscription.jsx
│   ├── Admin/
│   ├── Merchant/
│   └── Reseller/
├── App.jsx
└── main.jsx

supabase/
├── google_oauth_only_migration.sql
├── email_magic_link_auth_migration.sql
└── test_account_auth_setup.sql
```

## Testing checklist

- [ ] Login page defaults to the email OTP form (no password field anywhere in the OTP flow).
- [ ] A "Continue with Google" button is available below the OTP form.
- [ ] The Google button redirects to an official `accounts.google.com` page.
- [ ] Email OTP: submitting an email sends a 6-digit code; entering it signs the user in.
- [ ] A new account (either method) creates one row in `auth.users` on first login.
- [ ] The trigger creates one matching row in `public.profiles`.
- [ ] `profiles.email` matches the email used to sign in.
- [ ] `profiles.provider` is `google` for Google sign-ins, `email` for OTP sign-ins.
- [ ] Google sign-in: name and avatar come from Google metadata.
- [ ] First-time user (either method) is redirected to marketplace onboarding.
- [ ] Returning user is signed into the existing account, not duplicated.
- [ ] Refreshing a protected page preserves the session.
- [ ] An unauthenticated visit to a protected route redirects to `/login`.
- [ ] An authenticated user cannot manually update profile email, provider, or avatar.
- [ ] Logout removes the Supabase session and protected routes become inaccessible.
- [ ] A second login with the same account (Google or email) reuses the same profile row.
- [ ] The two hardcoded test accounts (`reseller@gmail.com`, `merchant@gmail.com`) can still sign in with a password; no other account can.
