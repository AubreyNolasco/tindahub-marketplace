// Same convention as _shared/payments/registry.ts — one adapters/<code>.ts
// file, registered here, gated by integration_configs.enabled (checked by
// get_integration_credentials in the calling edge function).

import type { StorageProviderAdapter } from './types.ts'
import { cloudinaryAdapter } from './adapters/cloudinary.ts'
import { googleDriveAdapter } from './adapters/google_drive.ts'

const registry = new Map<string, StorageProviderAdapter>([
  [cloudinaryAdapter.code, cloudinaryAdapter],
  [googleDriveAdapter.code, googleDriveAdapter],
])

export function getAdapter(code: string): StorageProviderAdapter {
  const adapter = registry.get(code)
  if (!adapter) throw new Error(`No storage adapter registered for provider "${code}"`)
  return adapter
}
