// Adding a model provider means writing one adapters/<code>.ts file and
// registering it here — nothing else in the engine changes. Same
// convention as _shared/delivery/registry.ts.
//
// ai.openai stays unregistered (seeded but never built — a paid
// provider nobody asked for yet). Until ai.groq has a real key in
// integration_configs, JomBits keeps answering from
// src/config/jomBitsKnowledge.js exactly as it does today.

import type { AiProviderAdapter } from './types.ts'
import { groqAdapter } from './adapters/groq.ts'

const registry = new Map<string, AiProviderAdapter>([
  [groqAdapter.code, groqAdapter],
])

export function getAdapter(code: string): AiProviderAdapter {
  const adapter = registry.get(code)
  if (!adapter) throw new Error(`No AI adapter registered for provider "${code}"`)
  return adapter
}
