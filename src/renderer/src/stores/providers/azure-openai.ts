import type { BuiltinProviderPreset } from './types'

export const azureOpenaiPreset: BuiltinProviderPreset = {
  builtinId: 'azure-openai',
  name: 'Azure OpenAI',
  type: 'openai-chat',
  defaultBaseUrl: '',
  homepage: 'https://azure.microsoft.com/products/ai-services/openai-service/',
  defaultModels: [
    { id: 'gpt-4o', name: 'GPT-4o', icon: 'openai', enabled: true, contextLength: 128_000, maxOutputTokens: 16_384, supportsVision: true, supportsFunctionCall: true, inputPrice: 2.5, outputPrice: 10, cacheCreationPrice: 2.5, cacheHitPrice: 1.25 },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', icon: 'openai', enabled: true, contextLength: 128_000, maxOutputTokens: 16_384, supportsVision: true, supportsFunctionCall: true, inputPrice: 0.15, outputPrice: 0.6, cacheCreationPrice: 0.15, cacheHitPrice: 0.075 },
    { id: 'gpt-4.1', name: 'GPT-4.1', icon: 'openai', enabled: true, contextLength: 1_048_576, maxOutputTokens: 32_768, supportsVision: true, supportsFunctionCall: true, inputPrice: 2, outputPrice: 8, cacheCreationPrice: 2, cacheHitPrice: 0.5 },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', icon: 'openai', enabled: true, contextLength: 1_048_576, maxOutputTokens: 32_768, supportsVision: true, supportsFunctionCall: true, inputPrice: 0.4, outputPrice: 1.6, cacheCreationPrice: 0.4, cacheHitPrice: 0.1 },
  ],
}
