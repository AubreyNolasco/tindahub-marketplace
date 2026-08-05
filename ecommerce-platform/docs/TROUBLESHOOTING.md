# JOM HUB — Troubleshooting Guide

Common problems and how to resolve them, grouped by who's affected. If your issue isn't listed here, check the [FAQ](./FAQ.md) or ask **JOM Bits** in-app — it answers based on how JOM HUB actually works.

---

## For Merchants & Resellers

### "I signed up but can't post products / place orders yet"
This is expected, not a bug. New accounts land in their dashboard immediately, but transacting stays locked until Admin approves the required items:
- **Merchant**: business permit *and* subscription payment, reviewed separately.
- **Reseller**: identity verification *and* initial wallet top-up, reviewed separately.

Check your dashboard for the pending status of each item. If your permit review is taking a while and you need to start selling, ask Admin about **temporary access** (a time-boxed grace period).

### "My wallet top-up hasn't been credited"
Top-ups are reviewed manually against the actual payment record before they're credited — this isn't instant. Make sure you submitted: the correct amount, a **one-use reference number** (a reused reference is automatically blocked), and a clear proof-of-payment image. If it's been an unusually long time, contact support.

### "My withdrawal is delayed or was rejected"
Withdrawals have a ₱500 minimum, a ₱100,000 daily limit, and a **24-hour wait after you change your payout destination** — this last one is a safety measure, not an error. A rejected withdrawal automatically returns the held amount to your wallet; check for a rejection note explaining why.

### "The Reseller declined my shipping fee" (Merchant)
The Reseller must accept your quoted courier fee before you can dispatch — this is by design, so nothing ships on an unconfirmed cost. Read their decline note, then either revise the fee/courier and resubmit, or use the cancellation process if they still won't accept the product.

### "My order isn't completing" / "I want to dispute an order"
Orders auto-complete 7 days after the estimated delivery date *if no dispute is open*. If something's wrong with what arrived, open a dispute (or a cancellation/return/replacement/refund case) before that window closes — an open case pauses automatic completion so it doesn't get released while you're still resolving it.

### "I can't see all my rows / items in a list"
Some admin-side lists paginate at 10 rows by default. If you're an Admin and a list looks incomplete, check for pagination controls at the bottom before assuming data is missing.

### "JOM Bits isn't answering in the language I asked in"
JOM Bits detects Tagalog vs. English from your question and answers in the same language, whether or not AI mode is active. If you notice a mismatch, try rephrasing — very short or mixed-language questions are the hardest case to detect correctly.

### "A page looks broken or a button doesn't respond"
1. Refresh the page first — a stale session or a slow network request can look like a broken UI.
2. If you're on Chrome, check whether a browser extension (ad blocker, privacy extension) is blocking requests to the site — this can silently prevent parts of the page from working with no visible error. Try Incognito mode to confirm; if it works there, whitelist the site in your extension settings.
3. If it still doesn't work, note the exact page, what you clicked, and any error message, then contact support.

---

## For Admin / Staff

### "I approved something by mistake" / "How do I undo an approval?"
Most approvals are one-directional by design (to keep the audit trail meaningful), but several have a documented reversal path:
- A suspended Merchant/Reseller can be **Reinstated**.
- An approved withdrawal can't be un-sent once marked Sent — coordinate directly with the recipient instead.
- For anything without an obvious undo, use the smallest controlled correction and document it — see "Incident, Error & Recovery Procedure" in the [Admin Guide](./ADMIN_GUIDE.md#security).

### "Payment reference looks like a duplicate but the system didn't block it"
Reference matching ignores spaces, dashes, and capitalization — if two references pass as different, they genuinely differ in their actual characters. Double check by comparing them side by side, not just visually.

### "A merchant/reseller says they can't log in"
Check **Login History** for failed attempts and the account's current status (suspended accounts are blocked from login-driven actions but not necessarily from viewing). Never ask a user for their OTP, password, or bank OTP over chat or email to "help" them log in — that's a phishing pattern, not a real support step.

### "I need to investigate something in the database directly"
Use Activity Audit and the relevant report first — most questions ("who changed this, when, from what to what") are answerable there without touching the database. If you do need direct database access, never run reset, cleanup, or destructive SQL as a first response, and never place the Supabase service-role key in frontend environment variables.

### General incident response
Follow the **Incident, Error & Recovery Procedure** in the Admin Guide: record the exact error/role/page/reference/time, pause the affected flow instead of retrying repeatedly, check Activity Audit / Login History / Supabase logs, apply the smallest controlled correction, then reconcile and document before closing.

---

## For developers / maintainers

### CI failing on `npx eslint .` or `npm test`
Run the same commands locally before pushing: `npm run build && npx eslint . && npm test` (see the repository [README](../README.md)). All three must pass — this is enforced on every push via `.github/workflows/ci.yml`.

### A Supabase Edge Function call fails only from the browser, not from curl
This is almost always a CORS preflight issue — check that every header the browser actually sends (including `x-client-info`, which `supabase-js` adds automatically) is listed in the function's `Access-Control-Allow-Headers`. A missing header there causes the browser to block the request silently before it reaches the function.

### A third-party integration isn't working after adding credentials
Check `is_integration_enabled` / `get_integration_credentials` against the `integration_configs` table, and check `integration_event_logs` for the actual error the adapter received. Each integration's `*_SETUP.md` file in the repository root documents the exact credential fields it expects — double-check you saved the value under the right field name, not just any name.
