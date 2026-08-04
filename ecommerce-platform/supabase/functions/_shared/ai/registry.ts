// Adding a model provider means writing one adapters/<code>.ts file and
// registering it here — nothing else in the engine changes. Same
// convention as _shared/delivery/registry.ts.
//
// Empty until ai.openai has a real key in integration_configs. Until
// then, JomBits keeps answering from src/config/jomBitsKnowledge.js
// exactly as it does today — see the note on that in the summary below.

import type { AiProviderAdapter } from './types.ts'

const registry = new Map<string, AiProviderAdapter>([
  // [openaiAdapter.code, openaiAdapter],
])

export function getAdapter(code: string): AiProviderAdapter {
  const adapter = registry.get(code)
  if (!adapter) throw new Error(`No AI adapter registered for provider "${code}"`)
  return adapter
}
