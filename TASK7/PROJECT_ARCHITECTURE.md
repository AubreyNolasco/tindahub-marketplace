# JOM HUB — Project Architecture (Source of Truth)

This document is the official architecture specification for JOM HUB, as given by the project owner. It takes precedence over any conflicting assumption in code, other docs, or prior AI-generated summaries.

## 1. System Architecture

```
                             JOM HUB Platform
──────────────────────────────────────────────────────────────────────

                    Public Website (Landing)
                              │
                              ▼
                       Authentication
                     (Login / Register)
                              │
                              ▼
                        Marketplace Hub
         (Shopping • Food • Services • Referral Platform)
                              │
      ┌───────────────────────┼──────────────────────────┐
      │                       │                          │
      ▼                       ▼                          ▼
 Products                Merchant Stores          Referral Services
 Food                    Merchant Pages           Clinic Referral
 Services                Product Listings         Real Estate Referral
 Categories              Store Reviews            Booking
 Flash Sale              Store Followers          Appointment
 Discounts               Store Ratings

                              │
                              ▼
                    Customer Experience
                     Browse • Search • Buy
                     Book • Checkout • Track
                     Wishlist • Reviews

──────────────────────────────────────────────────────────────────────

                     Business Panel
      ┌──────────────────────────────────────────────────────────┐
      │                                                          │
      ▼                                                          ▼
 Merchant Dashboard                                  Reseller Dashboard
 Store Management                                    Referral Management
 Products                                            Customers
 Services                                            Wallet
 Orders                                              Orders
 Discounts                                           Reports
 Flash Sale                                          Analytics

                              ▲
                              │
                       Admin Dashboard
                Platform Management
                Merchant Approval
                User Management
                Reports
                Categories
                System Settings
```

## 2. The Three Modules

### Landing Website — Marketing only
Contains: Home, About, How It Works, Testimonials, FAQ, Become Merchant, Become Reseller.
**Never place business management here.**

### Marketplace — Customer Experience
Contains: Products, Food, Services, Merchant Stores, Clinic Referral, Real Estate Referral, Search, Categories, Discounts, Flash Sale, Checkout.
**Marketplace is NOT the Dashboard.**

### Business Panel — Business Management
Contains: Merchant Dashboard, Reseller Dashboard, Admin Dashboard, Orders, Wallet, Products, Reports, Customers, Analytics.
**Business Panel is NOT the Marketplace.**

## 3. Navigation Flow

```
Landing Website → Login → Marketplace → Business Panel (optional)
```

- Customer can stay in Marketplace.
- Merchant can switch to Dashboard.
- Reseller can switch to Dashboard.
- Admin can switch to Dashboard.
- Marketplace and Business Panel are independent modules, connected only through Authentication.

## 4. Absolute Rules

- Marketplace must **never** replace the Business Panel.
- Business Panel must **never** replace the Marketplace.
- Landing Website must **never** replace the Marketplace.
- Authentication is the bridge between all modules.
- Each module has a single responsibility:
  - **Landing Website** = Marketing
  - **Marketplace** = Customer Shopping & Referral Platform
  - **Business Panel** = Business Management

## 5. How this maps onto the actual codebase (`ecommerce-platform/`)

This section is not part of the owner's original spec — it is a factual mapping of the rule above onto the code that exists today, added so this document stays useful as a working reference instead of only an abstract diagram. If code and this section ever disagree, **the diagram above still wins**; flag the conflict per `CLAUDE_INSTRUCTIONS.md`, don't silently pick one.

| Architecture concept | Current implementation |
|---|---|
| Landing Website | `src/pages/Home.jsx` and other public marketing routes in `App.jsx` (Terms, Privacy, Merchant/Reseller Agreement, FAQ, etc.) |
| Authentication | `src/pages/Login.jsx`, `src/contexts/AuthContext.jsx` — Supabase Auth, OTP email-code sign-in (no passwords) |
| Marketplace (customer shopping) | `src/pages/Catalog.jsx`, `src/pages/ProductDetail.jsx`, `src/pages/ResellerStorefront.jsx` (public reseller storefront links), storefront ordering flow |
| Business Panel → Merchant Dashboard | `src/pages/Merchant/*` (`MerchantLayout.jsx` + child pages: Products, Campaigns, Orders, Wallet, Delivery Settings, etc.) |
| Business Panel → Reseller Dashboard | `src/pages/Reseller/*` (`Cart.jsx`, `Checkout.jsx`, `Customers.jsx`, `Orders`, `Wallet`, storefront order requests) |
| Business Panel → Admin Dashboard | `src/pages/Admin/*` (`AdminLayout.jsx` + Merchants approval, Campaigns, Integrations, Sales/Reports, Reseller ID Verification, etc.) |
| Referral Services (Clinic / Real Estate) | `src/pages/Merchant/ClinicServices.jsx`, `src/pages/Reseller/*referral*` — service-referral/booking flow, a distinct product line from physical-goods shopping |

**Known deviation to watch for:** some role dashboards currently live under route prefixes like `/merchant/...` and `/reseller/...` rather than a single unified `/business-panel/...` prefix. This is a routing detail, not an architecture violation — each dashboard is still its own module, gated by role, reached only through Authentication. Do not "fix" this by merging routes into the Marketplace or Landing site.
