// Adding a carrier means writing one adapters/<code>.ts file and
// registering it here — nothing else in the engine changes. Same
// convention as _shared/delivery/registry.ts.

import type { SmsProviderAdapter } from './types.ts'
import { semaphoreAdapter } from './adapters/semaphore.ts'

const registry = new Map<string, SmsProviderAdapter>([
  [semaphoreAdapter.code, semaphoreAdapter],
])

export function getAdapter(code: string): SmsProviderAdapter {
  const adapter = registry.get(code)
  if (!adapter) throw new Error(`No SMS adapter registered for provider "${code}"`)
  return adapter
}
