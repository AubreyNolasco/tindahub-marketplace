# RM HUB Google OAuth Setup

## 1. Apply the database migration

Open Supabase Dashboard → SQL Editor and run `supabase/google_oauth_only_migration.sql` after the existing project migrations. This adds Google identity fields, the one-profile-per-user trigger, immutable identity protection, RLS, and the secure marketplace-onboarding RPC.

## 2. Configure the Google Cloud project

1. Open Google Cloud Console → Google Auth Platform.
2. Create or select the RM HUB project.
3. Configure Branding with the RM HUB application name, support email, and authorized domain used by the deployed site.
4. Configure Audience. Use External for public Google accounts. While the app is in Testing, add every Google account that will test it under Test users.
5. Open Clients → Create Client → Web application.
6. Add this exact Authorized redirect URI:

   `https://ttscpfsodrcyllyvvqzb.supabase.co/auth/v1/callback`

7. Save and securely copy the generated Client ID and Client Secret. Never put the Client Secret in this Vite project or in a `VITE_` environment variable.

## 3. Configure Supabase Auth

1. Open Supabase Dashboard → Authentication → Providers → Google.
2. Enable Google.
3. Paste the Google Client ID and Client Secret, then save.
4. Open Authentication → URL Configuration.
5. Keep the production site as Site URL.
6. Add `http://127.0.0.1:5173/auth/callback` and `http://localhost:5173/auth/callback` to Redirect URLs for local testing.
7. Add the deployed HTTPS `/auth/callback` URL to Redirect URLs before production testing.
8. Disable Email provider sign-in and email signup. Do not enable another social provider. Google must be the only enabled public authentication provider.

## 4. Environment configuration

The browser needs only the existing project URL and publishable/anon key:

```env
VITE_SUPABASE_URL=https://ttscpfsodrcyllyvvqzb.supabase.co
VITE_SUPABASE_ANON_KEY=use-the-existing-project-anon-or-publishable-key
```

The Google Client Secret belongs only in Supabase Dashboard. It must never be stored in `.env`, frontend JavaScript, Git, or Vercel browser environment variables.

## 5. Local test flow

1. Run `npm run dev -- --host 127.0.0.1`.
2. Open `http://127.0.0.1:5173/login`.
3. Click **Continue with Google**.
4. Confirm the browser opens Google’s official account-selection/consent page.
5. Complete Google authentication.
6. Confirm the callback returns to `/auth/callback`, then `/onboarding` for a first-time user.
7. Complete marketplace onboarding. Existing users should go directly to the appropriate approval screen or dashboard.

## Authentication file structure

```text
src/
├── components/
│   ├── auth/
│   │   └── AuthShell.jsx
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
└── google_oauth_only_migration.sql
```

## Testing checklist

- [ ] Login page contains no email or password field.
- [ ] Login page has one Google authentication button.
- [ ] Button redirects to an official `accounts.google.com` page.
- [ ] A Google account creates one row in `auth.users` on first login.
- [ ] The trigger creates one matching row in `public.profiles`.
- [ ] `profiles.email` matches the email returned by Google.
- [ ] `profiles.provider` is `google`.
- [ ] Name and avatar come from Google metadata.
- [ ] First-time user is redirected to marketplace onboarding.
- [ ] Returning user is signed into the existing account, not duplicated.
- [ ] Refreshing a protected page preserves the session.
- [ ] An unauthenticated visit to a protected route redirects to `/login`.
- [ ] An authenticated user cannot manually update profile email, provider, or avatar.
- [ ] Logout removes the Supabase session and protected routes become inaccessible.
- [ ] A second login with the same Google account reuses the same profile row.
- [ ] Email/password login is disabled in Supabase Dashboard.
