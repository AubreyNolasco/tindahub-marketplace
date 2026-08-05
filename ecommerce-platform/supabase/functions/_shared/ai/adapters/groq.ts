// Groq adapter — https://console.groq.com/docs/api-reference (free tier:
// no credit card, OpenAI-compatible chat completions endpoint, run on
// Groq's LPU hardware for fast responses).
// credentials shape: { api_key: string, model?: string }
//
// Free-tier limits are per-model and shift with Groq's lineup (checked
// at write time: 30 requests/min, ~1,000 requests/day and ~100K
// tokens/day for the bigger llama-3.3-70b-versatile model). Defaults to
// llama-3.1-8b-instant here — smaller/cheaper models generally get more
// generous free-tier daily quotas than the flagship ones, and this
// adapter's grounded, narrow-scope Q&A doesn't need 70b-level reasoning.
// `model` is admin-configurable in Settings -> Integrations so a bigger
// model (or Groq's future lineup) can be swapped in without a code
// change. VERIFY current limits at https://console.groq.com/docs/rate-limits
// before enabling.
//
// Live-verified against a real Groq API key and a real browser session —
// confirmed working end to end (including the x-client-info CORS fix in
// jombits-ask/index.ts, without which the browser blocks the call before
// it ever reaches this function).

import type { AiProviderAdapter, AiAnswerResult } from '../types.ts'

interface GroqCredentials {
  api_key: string
  model?: string
}

const DEFAULT_MODEL = 'llama-3.1-8b-instant'
const API_URL = 'https://api.groq.com/openai/v1/chat/completions'

const SYSTEM_PROMPT_TEMPLATE = (role: string, knowledgeScope: string) => `CRITICAL RULE, before anything else: reply in the SAME language the user's question is written in. If they write in Tagalog/Filipino, your entire reply must be in Tagalog/Filipino. If Bisaya/Cebuano, reply in Bisaya. If Taglish (mixed), reply in Taglish. If English, reply in English. This is not optional — a Tagalog question answered in English is a wrong answer, even if the facts are correct. Never mention that you're translating; just answer naturally in that language.

Example: if asked "paano mag order", answer entirely in Tagalog like "Pumili ng naka-save na customer, suriin ang quantity at presyo..." — never switch to English partway through.

You are JOM Bits, the official assistant inside the JOM HUB marketplace platform. The user is signed in as a ${role}.

Answer ONLY using the knowledge below — it is the complete, current JOM HUB process reference for this role, written in English as source material for you to translate, not to copy language from. Do not use outside knowledge, do not guess at policy, and do not invent numbers, fees, or steps that aren't in it. If the question can't be answered from this knowledge, say plainly (in the user's language) that you don't have that information and suggest they check the relevant page or contact support — never make something up to sound helpful.

Keep answers short (2-4 sentences), direct, and practical, matching the tone of the reference material.

JOM HUB KNOWLEDGE (English source only — your reply's language always matches the user's question, not this text):
${knowledgeScope}

REMINDER: match the language of the user's question above everything else in these instructions.`

export const groqAdapter: AiProviderAdapter = {
  code: 'ai.groq',

  async answer(question: string, context: { role: string; knowledgeScope: string }, credentials: unknown): Promise<AiAnswerResult> {
    const creds = credentials as GroqCredentials
    if (!creds?.api_key) {
      return { ok: false, error: { code: 'MISSING_CREDENTIALS', message: 'Groq API key is not configured', retryable: false } }
    }
    const model = creds.model?.trim() || DEFAULT_MODEL
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.api_key}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT_TEMPLATE(context.role, context.knowledgeScope) },
            { role: 'user', content: question },
          ],
          temperature: 0.3,
          max_tokens: 400,
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        const message = body?.error?.message || `Groq returned HTTP ${res.status}`
        const rateLimited = res.status === 429
        return { ok: false, raw: body, error: { code: rateLimited ? 'RATE_LIMITED' : 'GROQ_API_ERROR', message, retryable: res.status >= 500 || rateLimited } }
      }
      const answer: string = body?.choices?.[0]?.message?.content || ''
      if (!answer) {
        return { ok: false, raw: body, error: { code: 'EMPTY_RESPONSE', message: 'Groq returned an empty response', retryable: false } }
      }
      return { ok: true, answer: answer.trim(), raw: body }
    } catch (error) {
      return { ok: false, error: { code: 'NETWORK_ERROR', message: error instanceof Error ? error.message : 'Unknown network error', retryable: true } }
    }
  },
}
