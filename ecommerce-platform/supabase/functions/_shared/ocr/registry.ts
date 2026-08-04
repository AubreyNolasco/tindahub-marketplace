// Adding an OCR provider means writing one adapters/<code>.ts file and
// registering it here — nothing else in the engine changes. Same
// convention as _shared/delivery/registry.ts and _shared/payments/registry.ts.

import type { OcrProviderAdapter } from './types.ts'
import { googleVisionAdapter } from './adapters/google_vision.ts'

const registry = new Map<string, OcrProviderAdapter>([
  [googleVisionAdapter.code, googleVisionAdapter],
])

export function getAdapter(code: string): OcrProviderAdapter {
  const adapter = registry.get(code)
  if (!adapter) throw new Error(`No OCR adapter registered for provider "${code}"`)
  return adapter
}
