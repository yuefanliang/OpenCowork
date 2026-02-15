import type { BuiltinProviderPreset } from './types'

export const xiaomiPreset: BuiltinProviderPreset = {
  builtinId: 'xiaomi',
  name: '小米',
  type: 'openai-chat',
  defaultBaseUrl: 'https://api.xiaomimimo.com/v1',
  homepage: 'https://platform.xiaomimimo.com/',
  defaultModels: [
    {
      id: 'mimo-v2-flash',
      name: 'MiMo V2 Flash',
      icon: 'mimo',
      enabled: true,
      contextLength: 262_144,
      maxOutputTokens: 131_072,
      supportsVision: false,
      supportsFunctionCall: true,
      inputPrice: 0.1,
      cacheHitPrice: 0.01,
      outputPrice: 0.3,
      supportsThinking: true,
      thinkingConfig: {
        bodyParams: { thinking: { type: 'enabled' } },
        disabledBodyParams: { thinking: { type: 'disabled' } },
      },
    },
  ],
}
