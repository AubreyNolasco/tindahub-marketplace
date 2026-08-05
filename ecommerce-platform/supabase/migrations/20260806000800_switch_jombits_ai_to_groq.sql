-- =====================================================================
-- Swap JomBits' AI provider from Gemini to Groq.
--
-- 20260806000700_gemini_jombits.sql seeded 'ai.gemini' minutes before
-- this migration, before ever being enabled or given credentials — so
-- this replaces that row outright rather than leaving a dead
-- integration_configs entry behind, same precedent as
-- 20260806000500_switch_maps_to_locationiq.sql. Nothing else from that
-- migration (the AI adapter contract, the grounding knowledge text)
-- changes.
--
-- Reasoning: user wanted the highest practical free-tier ceiling for a
-- chat widget. Gemini's free tier caps at ~500 requests/day (hard daily
-- limit). Groq's free tier is rate-limited per-minute (30 RPM) rather
-- than gated primarily by a low daily request count, which fits bursty,
-- spread-out chat-widget traffic better in practice — though it still
-- has real daily caps (~1,000 requests/day, ~100K tokens/day on the
-- flagship model), it is not literally unlimited, and no free tier is.
-- =====================================================================

delete from public.integration_configs where key = 'ai.gemini';

insert into public.integration_configs (key, label) values
  ('ai.groq', 'Groq (JomBits AI answers)')
on conflict (key) do nothing;

notify pgrst, 'reload schema';
