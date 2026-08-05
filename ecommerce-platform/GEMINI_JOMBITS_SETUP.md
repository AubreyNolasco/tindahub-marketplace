# Gemini-backed JOM Bits

JOM Bits (`src/components/assistant/JomBits.jsx`) already answers questions today — but purely from a client-side keyword matcher (`src/config/jomBitsKnowledge.js`) with no network call at all. It only ever matches questions someone already anticipated and wrote a keyword list for; anything phrased differently falls through.

This adds a real LLM (Google Gemini, free tier) behind it. It is **off by default** and additive — the keyword matcher stays exactly as it is, and is what JomBits falls back to instantly whenever Gemini is disabled, unconfigured, rate-limited, or the call fails for any reason. The user never sees an error state; they just get the same keyword-matched answer they'd have gotten before this existed.

## The important part: the model is grounded, not open-ended

"Any question, but grounded in the system you built" — that's the actual ask, not a general-purpose chatbot. So the edge function doesn't just forward the question to Gemini. It builds a system prompt that:
- Includes the full JOM HUB process reference (`_shared/ai/knowledge.ts` — a server-side mirror of `jomBitsKnowledge.js`'s content) as the model's *only* allowed source of truth.
- Explicitly instructs the model to say "I don't have that information" rather than guess, invent a fee, or answer from general knowledge, whenever the question falls outside that reference.
- Never includes the user's account data (wallet balance, orders, personal info) — only their typed question, their role (reseller/merchant), and the fixed knowledge text. There is nothing sensitive in what gets sent to Gemini even before considering that the key itself is called server-side.

`_shared/ai/knowledge.ts` has a **KEEP IN SYNC** comment at the top — if `jomBitsKnowledge.js`'s content changes (a fee changes, a new feature ships), that file needs the same update or the AI answers with outdated policy while the keyword matcher already has the correct one.

## Why this is a Vault secret, not a public env var (unlike Maps)

Gemini is called from the `jombits-ask` edge function, never the browser — same shape as PayMongo/Vision/Semaphore. The API key goes through Settings → Integrations → Credentials exactly like those, into Supabase Vault, never a plaintext column or a `VITE_*` variable.

## 1. Apply the database migration

`supabase/migrations/20260806000700_gemini_jombits.sql` — additive only: seeds `ai.gemini` in `integration_configs`. (`ai.openai` was already seeded earlier for a paid provider that was never built — this doesn't touch or replace that row, they can coexist.)

## 2. Get a Gemini API key

1. Sign in at [Google AI Studio](https://aistudio.google.com) with any Google account — no credit card required for the free tier.
2. Get API key → Create API key.
3. Free tier is rate-limited (not metered) — check [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing) for the current free-tier model and request limits before enabling; Google ships new Flash model versions every few months and the free-tier roster shifts with them.

## 3. Configure in Settings → Integrations

Open Admin → Settings → Integrations → Google Gemini (JomBits AI answers):
- **Enabled**: on (only once you're ready to let JomBits call it)
- **Credentials**: `api_key` = the key from step 2. Optionally add `model` = a specific model id (e.g. `gemini-2.5-flash`) if you want to pin one — leave it out and the adapter defaults to `gemini-2.5-flash`.
- Save — the key goes to Supabase Vault via `save_integration_config`, never a plaintext column.

## 4. Deploy

```bash
supabase db push
supabase functions deploy jombits-ask
```

No `--no-verify-jwt` needed — this function is only ever called by a signed-in user via the frontend SDK, which attaches their session JWT automatically.

Deploying is safe at any time — the function no-ops (`NOT_CONFIGURED`) until the integration is enabled with a real key in step 3, and JomBits silently keeps using the keyword matcher either way.

## 5. Test flow

1. In JomBits (any role), ask something the keyword matcher would normally miss — an oddly phrased or multi-part question.
2. Confirm a brief "Thinking..." state appears, then a real answer — grounded in JOM HUB's actual process, not generic advice.
3. Ask something genuinely outside JOM HUB's scope (e.g. "what's the weather today") — confirm it says it doesn't have that information rather than answering anyway.
4. Confirm the privacy banner inside JomBits changed to mention Gemini.
5. Check Settings → Integrations → Google Gemini → Logs — confirm a `jombits_answer` event logged.
6. Disable the integration and confirm JomBits still answers instantly from the keyword matcher, banner reverts, no error shown to the user.

## Files

```text
supabase/
├── migrations/20260806000700_gemini_jombits.sql
└── functions/
    ├── _shared/ai/
    │   ├── types.ts                  (AiProviderAdapter contract, pre-existing)
    │   ├── registry.ts               (getAdapter('ai.gemini'))
    │   ├── knowledge.ts              (server-side mirror of jomBitsKnowledge.js — KEEP IN SYNC)
    │   └── adapters/gemini.ts        (Gemini generateContent + grounding system prompt)
    └── jombits-ask/index.ts          (invoked by JomBits.jsx when ai.gemini is enabled)

src/
├── lib/services/ai.js                (isAiEnabled, askJomBitsAi)
└── components/assistant/JomBits.jsx  (falls back to the keyword matcher on any failure)
```

## Adding another model provider (e.g. the already-seeded OpenAI)

Same recipe as every other engine in this codebase:
1. Write `_shared/ai/adapters/openai.ts` implementing `AiProviderAdapter` from `types.ts`.
2. Register it in `_shared/ai/registry.ts`.
3. `jombits-ask` stays generic — swap which key `is_integration_enabled`/`get_integration_credentials` checks (or extend `JomBits.jsx` to prefer one over the other) if both are ever configured at once.
