// Google Gemini adapter — https://ai.google.dev/gemini-api/docs (free
// tier via Google AI Studio: no credit card, rate-limited rather than
// metered as of write time).
// credentials shape: { api_key: string, model?: string }
//
// The free-tier model roster shifts often (Google ships new Flash
// versions every few months and moves older ones between free/paid).
// `model` is admin-configurable in Settings -> Integrations specifically
// so this doesn't need a code change when that happens — defaults to
// gemini-2.5-flash, the stable/documented-free alias at write time.
// VERIFY the current free-tier model name at
// https://ai.google.dev/gemini-api/docs/pricing before enabling.
//
// VERIFY against a real Gemini API key before enabling in production —
// request/response shape below matches Google's published REST docs at
// write time but was never exercised against a live call, same caveat
// as every other adapter in this codebase.

import type { AiProviderAdapter, AiAnswerResult } from '../types.ts'

interface GeminiCredentials {
  api_key: string
  model?: string
}

const DEFAULT_MODEL = 'gemini-2.5-flash'
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

const SYSTEM_PROMPT_TEMPLATE = (role: string, knowledgeScope: string) => `You are JOM Bits, the official assistant inside the JOM HUB marketplace platform. The user is signed in as a ${role}.

Answer ONLY using the knowledge below — it is the complete, current JOM HUB process reference for this role. Do not use outside knowledge, do not guess at policy, and do not invent numbers, fees, or steps that aren't in it. If the question can't be answered from this knowledge, say plainly that you don't have that information and suggest they check the relevant page or contact support — never make something up to sound helpful.

Keep answers short (2-4 sentences), direct, and practical, matching the tone of the reference material.

JOM HUB KNOWLEDGE:
${knowledgeScope}`

export const geminiAdapter: AiProviderAdapter = {
  code: 'ai.gemini',

  async answer(question: string, context: { role: string; knowledgeScope: string }, credentials: unknown): Promise<AiAnswerResult> {
    const creds = credentials as GeminiCredentials
    if (!creds?.api_key) {
      return { ok: false, error: { code: 'MISSING_CREDENTIALS', message: 'Gemini API key is not configured', retryable: false } }
    }
    const model = creds.model?.trim() || DEFAULT_MODEL
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': creds.api_key },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT_TEMPLATE(context.role, context.knowledgeScope) }] },
          contents: [{ role: 'user', parts: [{ text: question }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        const message = body?.error?.message || `Gemini returned HTTP ${res.status}`
        return { ok: false, raw: body, error: { code: 'GEMINI_API_ERROR', message, retryable: res.status >= 500 || res.status === 429 } }
      }
      const answer: string = body?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      if (!answer) {
        const blockReason = body?.promptFeedback?.blockReason
        return { ok: false, raw: body, error: { code: blockReason || 'EMPTY_RESPONSE', message: blockReason ? `Gemini blocked the response: ${blockReason}` : 'Gemini returned an empty response', retryable: false } }
      }
      return { ok: true, answer: answer.trim(), raw: body }
    } catch (error) {
      return { ok: false, error: { code: 'NETWORK_ERROR', message: error instanceof Error ? error.message : 'Unknown network error', retryable: true } }
    }
  },
}
