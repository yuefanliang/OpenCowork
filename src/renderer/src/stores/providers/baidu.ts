import type { BuiltinProviderPreset } from './types'

export const baiduCodingPreset: BuiltinProviderPreset = {
  builtinId: 'baidu-coding',
  name: '百度智能云（套餐）',
  type: 'anthropic',
  defaultBaseUrl: 'https://qianfan.baidubce.com/anthropic/coding',
  homepage: 'https://cloud.baidu.com/product/codingplan.html',
  apiKeyUrl: 'https://console.bce.baidu.com/qianfan/resource/subscribe',
  defaultEnabled: true,
  defaultModels: [
    {
      id: 'qianfan-code-latest',
      name: 'Qianfan Code Latest（DeepSeek-V3.2 / GLM-4.7 / Kimi-K2.5 / MiniMax-M2.1）',
      icon: 'baidu',
      enabled: true,
      contextLength: 98_304,
      maxOutputTokens: 65_536,
      supportsFunctionCall: true,
    },
  ],
}

export const baiduPreset: BuiltinProviderPreset = {
  builtinId: 'baidu',
  name: '百度智能云（官方）',
  type: 'openai-chat',
  defaultBaseUrl: 'https://qianfan.baidubce.com/v2',
  homepage: 'https://cloud.baidu.com/product-s/qianfan_home',
  apiKeyUrl: 'https://cloud.baidu.com/doc/qianfan/s/wmh8l6tnf',
  defaultModels: [
    { id: 'deepseek-v3.2', name: 'DeepSeek V3.2', icon: 'deepseek', enabled: true, supportsFunctionCall: true },
    { id: 'glm-4.7', name: 'GLM 4.7', icon: 'chatglm', enabled: true, supportsFunctionCall: true },
    { id: 'kimi-k2.5', name: 'Kimi K2.5', icon: 'kimi', enabled: true, supportsFunctionCall: true },
    { id: 'MiniMax-M2.1', name: 'MiniMax M2.1', icon: 'minimax', enabled: true, supportsFunctionCall: true },
  ],
}
