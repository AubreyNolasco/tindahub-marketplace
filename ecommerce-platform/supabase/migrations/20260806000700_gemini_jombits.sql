-- =====================================================================
-- Gemini-backed JOM Bits — additive only.
--
-- JomBits.jsx already answers questions today via a pure client-side
-- keyword matcher (src/config/jomBitsKnowledge.js) — no AI, no network
-- call, scoped only to the questions someone already anticipated and
-- wrote a keyword list for. This adds a real LLM behind it that can
-- answer open-ended phrasing, but the model is instructed server-side to
-- answer ONLY from the same JOM HUB knowledge (mirrored in
-- _shared/ai/knowledge.ts) — never general knowledge, never guessed
-- policy. If disabled, unconfigured, or the call fails, JomBits falls
-- straight back to the existing keyword matcher, unchanged.
--
-- 'ai.openai' was already seeded in 20260804000100_integration_scaffolding.sql
-- for a *paid* provider that was never built. This adds 'ai.gemini'
-- alongside it (not a replacement) since Google AI Studio's Gemini API
-- has a genuinely free tier (no credit card) that fits this use case —
-- same reasoning as the LocationIQ pivot for maps. Unlike LocationIQ,
-- Gemini is called from the jombits-ask edge function, not the browser,
-- so it follows the normal Vault-credential pattern (PayMongo/Vision/
-- Semaphore), not the public-env-var one Maps needed.
-- =====================================================================

insert into public.integration_configs (key, label) values
  ('ai.gemini', 'Google Gemini (JomBits AI answers)')
on conflict (key) do nothing;
