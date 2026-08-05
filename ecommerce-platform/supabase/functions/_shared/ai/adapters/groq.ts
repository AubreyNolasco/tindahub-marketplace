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
// VERIFY against a real Groq API key before enabling in production —
// request/response shape below matches Groq's published REST docs at
// write time but was never exercised against a live call, same caveat
// as every other adapter in this codebase.

import type { AiProviderAdapter, AiAnswerResult } from '../types.ts'

interface GroqCredentials {
  api_key: string
  model?: string
}

const DEFAULT_MODEL = 'llama-3.1-8b-instant'
const API_URL = 'https://api.groq.com/openai/v1/chat/completions'

const SYSTEM_PROMPT_TEMPLATE = (role: string, knowledgeScope: string) => `You are JOM Bits, the official assistant inside the JOM HUB marketplace platform. The user is signed in as a ${role}.

Answer ONLY using the knowledge below — it is the complete, current JOM HUB process reference for this role, written in English. Do not use outside knowledge, do not guess at policy, and do not invent numbers, fees, or steps that aren't in it. If the question can't be answered from this knowledge, say plainly that you don't have that information and suggest they check the relevant page or contact support — never make something up to sound helpful.

The user may ask in any language — English, Tagalog/Filipino, Bisaya/Cebuano, Taglish, or any other. Detect the language of their question and reply in that same language, translating the knowledge below naturally. Never refuse or ask them to switch to English.

Keep answers short (2-4 sentences), direct, and practical, matching the tone of the reference material.

JOM HUB KNOWLEDGE (English source — translate your reply into the user's language):
${knowledgeScope}`

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
