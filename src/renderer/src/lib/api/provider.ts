import type { APIProvider, ProviderConfig, ProviderType } from './types'

const providers = new Map<ProviderType, () => APIProvider>()

export function registerProvider(type: ProviderType, factory: () => APIProvider): void {
  providers.set(type, factory)
}

export function createProvider(config: ProviderConfig): APIProvider {
  const factory = providers.get(config.type)
  if (!factory) {
    throw new Error(`Unknown provider type: ${config.type}`)
  }
  return factory()
}

export function getAvailableProviders(): ProviderType[] {
  return Array.from(providers.keys())
}
