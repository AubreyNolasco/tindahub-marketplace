# TindaHub — B2B Marketplace (Merchant / Reseller / Admin)

Kumpletong e-commerce system: signup/login, product catalog, cart, checkout na
may **GCash/Maya proof-of-payment upload**, order management, merchant wallet,
at admin approval panel. Gawa sa **React (Vite) + Tailwind CSS + Supabase**.

---

## Bago tayo magsimula

Kailangan mo lang ng:
1. [Node.js](https://nodejs.org/) (LTS version) na naka-install sa Windows mo
2. Libreng account sa [supabase.com](https://supabase.com)
3. VS Code (meron ka na)

---

## HAKBANG 1 — Gumawa ng bagong Supabase Project

1. Pumunta sa [supabase.com/dashboard](https://supabase.com/dashboard) → **New Project**
2. Pangalanan ng `tindahub` (o kahit ano), pumili ng region na **Southeast Asia (Singapore)** para mabilis
3. I-save ang **Database Password** na binigay sa 'yo — kakailanganin 'yan mamaya
4. Hintayin lang mag-provision (~2 minuto)

---

## HAKBANG 2 — I-set up ang Database

1. Sa Supabase dashboard, pumunta sa **SQL Editor** (kaliwang sidebar)
2. Buksan ang file na `supabase/schema.sql` mula sa zip na binigay ko
3. I-copy ang **buong laman** ng file, i-paste sa SQL Editor
4. Pindutin ang **Run** (o Ctrl+Enter)
5. Dapat makita mong "Success. No rows returned" — ibig sabihin gumana

> ⚠️ Kung may error na lumabas, i-run muna ang `supabase/reset_if_broken.sql`
> tapos ulitin ang Hakbang 2 mula sa umpisa.

---

## HAKBANG 3 — Kunin ang API Keys

1. Sa Supabase dashboard, pumunta sa **Project Settings → API**
2. Kopyahin ang dalawang bagay:
   - **Project URL** (halimbawa: `https://abcxyz.supabase.co`)
   - **anon public** key (mahabang text na nagsisimula sa `eyJ...`)

---

## HAKBANG 4 — I-configure ang Project sa Computer Mo

Buksan ang **PowerShell** sa folder ng project (i-extract muna ang zip), tapos:

```powershell
# 1. I-install ang mga dependencies
npm install

# 2. Kopyahin ang env file
copy .env.example .env
```

Buksan ang bagong `.env` file sa VS Code, palitan ng sarili mong Project URL
at anon key:

```
VITE_SUPABASE_URL=https://abcxyz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

I-save ang file.

---

## HAKBANG 5 — Patakbuhin ang App

```powershell
npm run dev
```

Buksan ang browser sa `http://localhost:5173` — dapat gumana na ang site!

---

## HAKBANG 6 — Gumawa ng Unang Admin Account

1. Sa website, **Sign Up** ka gamit ang email mo (piliin ang "Reseller" muna —
   walang epekto ito, papalitan lang natin sa susunod na step)
2. Balik sa Supabase **SQL Editor**
3. Buksan ang `supabase/make_admin.sql`, palitan ang email sa loob ng
   `'your-email@example.com'` ng email na ginamit mo sa signup
4. I-run ang query
5. Mag-**log out** at **log in** ulit sa website — Admin ka na!

---

## Paano gamitin ang system

### Bilang Merchant
1. Mag-sign up, piliin ang **Merchant**, ilagay ang pangalan ng negosyo
2. Hintayin **ma-approve ng Admin** (o gamitin ang Admin account mo para i-approve agad sa `/admin/merchants`)
3. Pumunta sa **Merchant → Mga Produkto** para magdagdag ng paninda
4. Kapag may order, pumunta sa **Merchant → Mga Order** para i-verify ang GCash/Maya proof of payment

### Bilang Reseller
1. Mag-sign up, piliin ang **Reseller**
2. I-browse ang **Catalog**, magdagdag sa cart
3. Sa **Checkout**, ilagay ang address, piliin ang GCash o Maya, i-upload ang screenshot ng bayad
4. I-track ang order sa **Reseller → Mga Order**

### Bilang Admin
1. **Admin → Mga Merchant** — i-approve/i-reject ang bagong merchant
2. **Admin → Mga Payment** — makikita lahat ng payment proofs across the platform

---

## Paglipat sa Internet (Deployment)

Kapag tapos na sa localhost at gusto mo nang ma-access online:

1. I-push ang code sa isang **GitHub repository**
2. Gumawa ng account sa [vercel.com](https://vercel.com), i-connect ang GitHub repo mo
3. Sa Vercel **Environment Variables**, ilagay ang parehong `VITE_SUPABASE_URL`
   at `VITE_SUPABASE_ANON_KEY` mula sa `.env` mo
4. I-deploy — libre ito sa Vercel free tier

---

## Istruktura ng Files

```
tindahub-marketplace/
├── supabase/
│   ├── schema.sql          ← buong database (tables, RLS, triggers, storage)
│   ├── make_admin.sql      ← gawing admin ang isang account
│   └── reset_if_broken.sql ← emergency reset kung magka-error sa schema
├── src/
│   ├── pages/
│   │   ├── Auth/           ← Login, Signup
│   │   ├── Reseller/       ← Dashboard, Cart, Checkout, Orders, Customers
│   │   ├── Merchant/       ← Dashboard, Products, Orders, Wallet
│   │   └── Admin/          ← Dashboard, Merchants, Payments
│   ├── contexts/           ← AuthContext, CartContext
│   ├── components/         ← Navbar, ProductCard, at iba pa
│   └── lib/supabase.js     ← Supabase client
└── .env                    ← sarili mong API keys (huwag i-share/i-commit!)
```

---

## Mga Features na Kasama

- ✅ Signup/Login na may 3 role: Merchant, Reseller, Admin
- ✅ Product catalog na may search at category filter
- ✅ Cart na naka-group per-merchant (isang checkout kada tindahan)
- ✅ Checkout na may GCash/Maya proof-of-payment upload
- ✅ Merchant order management + payment verification
- ✅ Merchant wallet na auto-credit kapag na-verify na ang bayad
- ✅ Admin panel para mag-approve/suspend ng merchant
- ✅ Reseller customer list (simpleng CRM)
- ✅ Row Level Security sa lahat ng tables (safe kahit sino ang naka-log in)
- ✅ Modern, mobile-friendly UI/UX

## Mga Susunod na Pwedeng Idagdag

- Automated payment gateway (PayMongo/Xendit) bilang alternatibo sa manual proof upload
- Real-time chat sa pagitan ng Merchant at Reseller (nasa database schema na, di pa gamit sa UI)
- Email notifications gamit ang Supabase Edge Functions
- Subscription/paid plan billing para sa mga merchant pagkatapos ng free trial

---

**Tip:** Kung may console error ka habang tumatakbo ang app, i-screenshot mo lang
at i-paste dito — same approach tayo tulad ng ginawa natin sa marketplace project mo dati.
