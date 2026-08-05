# Semaphore SMS Notifications

Sends an SMS to a user's phone on file when their wallet top-up is approved, or their withdrawal is approved/rejected. It is **off by default** and fires silently only once an admin enables it with real credentials — the existing manual/automated approval flows (admin's Approve/Reject buttons in TopupRequests.jsx/WithdrawalRequests.jsx, and PayMongo's auto-approval webhook) are completely untouched. This is a notification bolted onto those flows, not a new code path for them.

## How it works

- Two `AFTER UPDATE OF status` triggers — `trg_notify_topup_approved_sms` on `topup_requests`, `trg_notify_withdrawal_status_sms` on `withdrawal_requests` — fire on the status transition regardless of *who* changed it (manual admin approval or PayMongo's webhook), so there is exactly one place notification logic lives, not two.
- Each trigger does a fire-and-forget `net.http_post` to the `send-sms` edge function, authenticated with a shared secret (same convention as `notify_lalamove_dispatch_ready` → `lalamove-book`). The status update itself always succeeds regardless of whether the SMS send does.
- `send-sms` looks up `sms.semaphore` in `integration_configs` via `get_integration_credentials()`. If disabled or unconfigured, it acknowledges and no-ops (`{"ok":true,"skipped":"INTEGRATION_DISABLED"}`) — no error, no retry, nothing visible to the user or the admin who approved the request.
- If a user has no phone number on file (`profiles.phone`), the trigger returns early before ever calling the function.

## 1. Apply the database migration

`supabase/migrations/20260806000300_semaphore_sms_notifications.sql` — additive only:
- Two trigger functions + triggers described above.
- No existing table, column, RLS policy, or the approval flows themselves are touched.

## 2. Get a Semaphore API key

1. Sign up / log in at the Semaphore dashboard (semaphore.co).
2. Load credits (Semaphore is prepaid, per-SMS pricing — check current PH rates in your dashboard).
3. Copy your API key from Account → API Keys.
4. Optional: register a Sender Name (e.g. `JOMHUB`) if you want branded sender ID instead of a shared shortcode — approval can take a few business days, so the integration works fine without one in the meantime.

## 3. Set the dispatch secret (once)

Same shared-secret pattern as Lalamove's `LALAMOVE_DISPATCH_SECRET`/`lalamove_dispatch_secret` — a random value stored in two places so only these DB triggers (not the public internet) can invoke `send-sms`:

```bash
# generate any random string, e.g.:
openssl rand -hex 32

# store it as the edge function's env var
supabase secrets set SMS_DISPATCH_SECRET=<the random value>
```

Then store the **same** value in Vault as `sms_dispatch_secret` (Dashboard → Database → Vault → New secret, name `sms_dispatch_secret`) — the trigger reads it from `vault.decrypted_secrets` at call time. If the two values don't match, `send-sms` returns 401 and the SMS silently never sends (status update still succeeds).

## 4. Configure in Settings → Integrations

Open Admin → Settings → Integrations → Semaphore SMS:
- **Enabled**: on (only once you're ready to start sending real SMS)
- **Credentials**: `api_key` = the key from step 2, `sender_name` = your registered sender name (optional — omit to use Semaphore's default)
- Save — credentials go straight to Supabase Vault (`save_integration_config`), never a plaintext column.

## 5. Deploy

```bash
supabase db push
supabase functions deploy send-sms --no-verify-jwt
```

`--no-verify-jwt` is required — the triggers call this function via `pg_net`, which carries no Supabase session JWT (same reason `lalamove-book` and `paymongo-webhook` are deployed the same way). Authorization is the `x-cron-secret` header check in step 3, not Supabase's platform JWT gate.

Deploying is safe at any time — the function no-ops until the integration is enabled with real credentials in step 4.

## 6. Test flow

1. Set a phone number on a test Reseller/Merchant account (`profiles.phone`), e.g. `09171234567`.
2. As that user, submit a top-up request; as admin, approve it.
3. Confirm an SMS arrives within a few seconds.
4. Confirm the log: Settings → Integrations → Semaphore SMS → Logs shows an outbound `topup_approved` event, `success`.
5. Repeat for a withdrawal approval and a withdrawal rejection (`withdrawal_approved` / `withdrawal_rejected` event types).
6. Disable the integration again and confirm approvals/rejections still work exactly as before, with no SMS sent and no error surfaced anywhere in the UI.

## Files

```text
supabase/
├── migrations/20260806000300_semaphore_sms_notifications.sql
└── functions/
    ├── _shared/sms/
    │   ├── types.ts                  (SmsProviderAdapter contract, pre-existing)
    │   ├── registry.ts               (getAdapter('sms.semaphore'))
    │   └── adapters/semaphore.ts     (Semaphore Send Message API)
    └── send-sms/index.ts             (invoked only by the two triggers above)
```

## Adding the next carrier (Twilio)

Same recipe as adding a new delivery courier or payment gateway:
1. Write `_shared/sms/adapters/twilio.ts` implementing `SmsProviderAdapter` from `types.ts`.
2. Register it in `_shared/sms/registry.ts`.
3. `send-sms` and the two triggers stay generic — they call whichever adapter `integration_configs` says is active. If both carriers need to be live at once (e.g. per-user or fallback), that's a follow-up change to `send-sms`'s lookup logic, not needed for a straight swap.
