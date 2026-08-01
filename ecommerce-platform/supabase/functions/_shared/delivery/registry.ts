// Adding a new courier means writing one adapters/<code>.ts file and
// registering it here — nothing else in the engine changes.

import type { DeliveryProviderAdapter } from './types.ts'
import { lalamoveAdapter } from './adapters/lalamove.ts'

const registry = new Map<string, DeliveryProviderAdapter>([
  [lalamoveAdapter.code, lalamoveAdapter],
])

export function getAdapter(code: string): DeliveryProviderAdapter {
  const adapter = registry.get(code)
  if (!adapter) throw new Error(`No adapter registered for provider "${code}"`)
  return adapter
}
