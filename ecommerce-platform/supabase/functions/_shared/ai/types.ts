// AI Provider Engine — shared contract for AI-backed answer strategies
// (e.g. enhancing JomBits with OpenAI). `context` carries the same
// knowledge-base scope src/config/jomBitsKnowledge.js already enforces,
// so the model is grounded to JOM HUB topics server-side rather than
// trusting the model to stay in scope on its own.

export interface AiAnswerResult {
  ok: boolean
  answer?: string
  raw?: unknown
  error?: { code: string; message: string; retryable: boolean }
}

export interface AiProviderAdapter {
  code: string
  answer(question: string, context: { role: string; knowledgeScope: string }, credentials: unknown): Promise<AiAnswerResult>
}
