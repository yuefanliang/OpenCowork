import type { BuiltinProviderPreset } from './types'

export const openaiPreset: BuiltinProviderPreset = {
  builtinId: 'openai',
  name: 'OpenAI',
  type: 'openai-chat',
  defaultBaseUrl: 'https://api.openai.com/v1',
  homepage: 'https://openai.com',
  apiKeyUrl: 'https://platform.openai.com/api-keys',
  defaultModels: [
    // GPT-5 family (cache: 90% off input)
    { id: 'gpt-5.2', name: 'GPT-5.2', icon: 'openai', enabled: true, contextLength: 1_048_576, maxOutputTokens: 32_768, supportsVision: true, supportsFunctionCall: true, inputPrice: 1.75, outputPrice: 14, cacheCreationPrice: 1.75, cacheHitPrice: 0.175, supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' }, reasoningEffortLevels: ['none', 'low', 'medium', 'high', 'xhigh'], defaultReasoningEffort: 'medium' } },
    { id: 'gpt-5.1', name: 'GPT-5.1', icon: 'openai', enabled: true, contextLength: 1_048_576, maxOutputTokens: 32_768, supportsVision: true, supportsFunctionCall: true, inputPrice: 1.25, outputPrice: 10, cacheCreationPrice: 1.25, cacheHitPrice: 0.125, supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' }, reasoningEffortLevels: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'], defaultReasoningEffort: 'medium' } },
    { id: 'gpt-5', name: 'GPT-5', icon: 'openai', enabled: true, contextLength: 1_048_576, maxOutputTokens: 32_768, supportsVision: true, supportsFunctionCall: true, inputPrice: 1.25, outputPrice: 10, cacheCreationPrice: 1.25, cacheHitPrice: 0.125, supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' }, reasoningEffortLevels: ['minimal', 'low', 'medium', 'high'], defaultReasoningEffort: 'medium' } },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini', icon: 'openai', enabled: true, contextLength: 1_048_576, maxOutputTokens: 16_384, supportsVision: true, supportsFunctionCall: true, inputPrice: 0.25, outputPrice: 2, cacheCreationPrice: 0.25, cacheHitPrice: 0.025, supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' }, reasoningEffortLevels: ['minimal', 'low', 'medium', 'high'], defaultReasoningEffort: 'medium' } },
    { id: 'gpt-5-nano', name: 'GPT-5 Nano', icon: 'openai', enabled: true, contextLength: 1_048_576, maxOutputTokens: 16_384, supportsVision: false, supportsFunctionCall: true, inputPrice: 0.05, outputPrice: 0.4, cacheCreationPrice: 0.05, cacheHitPrice: 0.005, supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' }, reasoningEffortLevels: ['minimal', 'low', 'medium', 'high'], defaultReasoningEffort: 'medium' } },
    // O-series reasoning (cache: 50% off input)
    { id: 'o3', name: 'o3', icon: 'openai', enabled: true, contextLength: 200_000, maxOutputTokens: 100_000, supportsVision: true, supportsFunctionCall: true, inputPrice: 2, outputPrice: 8, cacheCreationPrice: 2, cacheHitPrice: 1, supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' }, reasoningEffortLevels: ['low', 'medium', 'high'], defaultReasoningEffort: 'medium' } },
    { id: 'o4-mini', name: 'o4 Mini', icon: 'openai', enabled: true, contextLength: 200_000, maxOutputTokens: 100_000, supportsVision: true, supportsFunctionCall: true, inputPrice: 1.1, outputPrice: 4.4, cacheCreationPrice: 1.1, cacheHitPrice: 0.55, supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' }, reasoningEffortLevels: ['low', 'medium', 'high'], defaultReasoningEffort: 'medium' } },
    { id: 'o3-mini', name: 'o3 Mini', icon: 'openai', enabled: true, contextLength: 200_000, maxOutputTokens: 100_000, supportsVision: false, supportsFunctionCall: true, inputPrice: 1.1, outputPrice: 4.4, cacheCreationPrice: 1.1, cacheHitPrice: 0.55, supportsThinking: true, thinkingConfig: { bodyParams: { reasoning_effort: 'medium' }, reasoningEffortLevels: ['low', 'medium', 'high'], defaultReasoningEffort: 'medium' } },
    // GPT-4.1 family (cache: 75% off input)
    { id: 'gpt-4.1', name: 'GPT-4.1', icon: 'openai', enabled: true, contextLength: 1_048_576, maxOutputTokens: 32_768, supportsVision: true, supportsFunctionCall: true, inputPrice: 2, outputPrice: 8, cacheCreationPrice: 2, cacheHitPrice: 0.5 },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', icon: 'openai', enabled: true, contextLength: 1_048_576, maxOutputTokens: 32_768, supportsVision: true, supportsFunctionCall: true, inputPrice: 0.4, outputPrice: 1.6, cacheCreationPrice: 0.4, cacheHitPrice: 0.1 },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', icon: 'openai', enabled: true, contextLength: 1_048_576, maxOutputTokens: 32_768, supportsVision: false, supportsFunctionCall: true, inputPrice: 0.1, outputPrice: 0.4, cacheCreationPrice: 0.1, cacheHitPrice: 0.025 },
    // GPT-4o family (cache: 50% off input)
    { id: 'gpt-4o', name: 'GPT-4o', icon: 'openai', enabled: true, contextLength: 128_000, maxOutputTokens: 16_384, supportsVision: true, supportsFunctionCall: true, inputPrice: 2.5, outputPrice: 10, cacheCreationPrice: 2.5, cacheHitPrice: 1.25 },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', icon: 'openai', enabled: true, contextLength: 128_000, maxOutputTokens: 16_384, supportsVision: true, supportsFunctionCall: true, inputPrice: 0.15, outputPrice: 0.6, cacheCreationPrice: 0.15, cacheHitPrice: 0.075 },
  ],
}
