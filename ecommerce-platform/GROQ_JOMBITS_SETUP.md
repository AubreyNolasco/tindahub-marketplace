# Groq-backed JOM Bits

JOM Bits (`src/components/assistant/JomBits.jsx`) already answers questions today — but purely from a client-side keyword matcher (`src/config/jomBitsKnowledge.js`) with no network call at all. It only ever matches questions someone already anticipated and wrote a keyword list for; anything phrased differently falls through.

This adds a real LLM (Groq, free tier) behind it. It is **off by default** and additive — the keyword matcher stays exactly as it is, and is what JomBits falls back to instantly whenever Groq is disabled, unconfigured, rate-limited, or the call fails for any reason. The user never sees an error state; they just get the same keyword-matched answer they'd have gotten before this existed.

## Why Groq (and the honest limits of "free")

No free AI tier is actually unlimited — every provider rate-limits somehow, or the cost of abuse would be unbounded for them. Between the realistic free options:
- **Gemini** (Google AI Studio): free, no credit card, but capped at a **flat ~500 requests/day** — a hard daily wall regardless of how traffic is spread out.
- **Groq**: free, no credit card, limited **per-minute (30 RPM)** rather than primarily by a low flat daily count. It still has daily caps too (roughly 1,000 requests/day and 100K tokens/day on the flagship model at write time) — not unlimited — but the per-minute shape fits a chat widget's naturally bursty, spread-out traffic much better in practice, so it's the harder limit to actually hit day-to-day.

This project started with Gemini, then switched to Groq for that reason. `DEFAULT_MODEL` in the adapter is `llama-3.1-8b-instant` rather than a bigger flagship model — smaller models generally get more generous free daily quotas, and this adapter's job (narrow, grounded FAQ answers) doesn't need flagship-level reasoning.

## The important part: the model is grounded, not open-ended

"Any question, but grounded in the system you built" — that's the actual ask, not a general-purpose chatbot. So the edge function doesn't just forward the question to Groq. It builds a system prompt that:
- Includes the full JOM HUB process reference (`_shared/ai/knowledge.ts` — a server-side mirror of `jomBitsKnowledge.js`'s content) as the model's *only* allowed source of truth.
- Explicitly instructs the model to say "I don't have that information" rather than guess, invent a fee, or answer from general knowledge, whenever the question falls outside that reference.
- Never includes the user's account data (wallet balance, orders, personal info) — only their typed question, their role (reseller/merchant), and the fixed knowledge text.

`_shared/ai/knowledge.ts` has a **KEEP IN SYNC** comment at the top — if `jomBitsKnowledge.js`'s content changes (a fee changes, a new feature ships), that file needs the same update or the AI answers with outdated policy while the keyword matcher already has the correct one.

## Why this is a Vault secret, not a public env var (unlike Maps)

Groq is called from the `jombits-ask` edge function, never the browser — same shape as PayMongo/Vision/Semaphore. The API key goes through Settings → Integrations → Credentials exactly like those, into Supabase Vault, never a plaintext column or a `VITE_*` variable.

## 1. Apply the database migrations

- `supabase/migrations/20260806000700_gemini_jombits.sql` — seeded `ai.gemini` (superseded by the next migration, kept for history — this is what the very first version of this feature used before the Groq switch).
- `supabase/migrations/20260806000800_switch_jombits_ai_to_groq.sql` — removes the never-enabled `ai.gemini` row, seeds `ai.groq` in its place. (`ai.openai` was seeded even earlier for a paid provider that was never built — untouched, can coexist.)

## 2. Get a Groq API key

1. Sign up free at [console.groq.com](https://console.groq.com) — no credit card required.
2. API Keys → Create API Key → copy it.
3. Check [console.groq.com/docs/rate-limits](https://console.groq.com/docs/rate-limits) for current free-tier limits before enabling — Groq's lineup and quotas shift over time, same caveat as every fast-moving LLM provider.

## 3. Configure in Settings → Integrations

Open Admin → Settings → Integrations → Groq (JomBits AI answers):
- **Enabled**: on (only once you're ready to let JomBits call it)
- **Credentials**: `api_key` = the key from step 2. Optionally add `model` = a specific model id (e.g. `llama-3.3-70b-versatile` for better reasoning at the cost of a lower daily quota) — leave it out and the adapter defaults to `llama-3.1-8b-instant`.
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
4. Confirm the privacy banner inside JomBits changed to mention Groq.
5. Check Settings → Integrations → Groq → Logs — confirm a `jombits_answer` event logged.
6. Disable the integration and confirm JomBits still answers instantly from the keyword matcher, banner reverts, no error shown to the user.

## Files

```text
supabase/
├── migrations/
│   ├── 20260806000700_gemini_jombits.sql
│   └── 20260806000800_switch_jombits_ai_to_groq.sql
└── functions/
    ├── _shared/ai/
    │   ├── types.ts                  (AiProviderAdapter contract, pre-existing)
    │   ├── registry.ts               (getAdapter('ai.groq'))
    │   ├── knowledge.ts              (server-side mirror of jomBitsKnowledge.js — KEEP IN SYNC)
    │   └── adapters/groq.ts          (Groq chat completions + grounding system prompt)
    └── jombits-ask/index.ts          (invoked by JomBits.jsx when ai.groq is enabled)

src/
├── lib/services/ai.js                (isAiEnabled, askJomBitsAi)
└── components/assistant/JomBits.jsx  (falls back to the keyword matcher on any failure)
```

## Adding another model provider (e.g. the already-seeded OpenAI, or Gemini as a fallback)

Same recipe as every other engine in this codebase:
1. Write `_shared/ai/adapters/<code>.ts` implementing `AiProviderAdapter` from `types.ts`.
2. Register it in `_shared/ai/registry.ts`.
3. `jombits-ask` currently only tries `ai.groq`. To chain a second free tier as a fallback (e.g. try Groq, then Gemini, then the keyword matcher) — for a higher combined ceiling than either alone — extend `jombits-ask/index.ts` to attempt a second `is_integration_enabled`/`get_integration_credentials`/adapter call if the first one fails, before giving up and returning an error to the frontend.
