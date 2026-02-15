import type { BuiltinProviderPreset } from './types'

export const giteeAiPreset: BuiltinProviderPreset = {
  builtinId: 'gitee-ai',
  name: 'Gitee AI',
  type: 'openai-chat',
  defaultBaseUrl: 'https://ai.gitee.com/v1',
  homepage: 'https://ai.gitee.com',
  defaultModels: [
    // ── DeepSeek ──
    { id: 'DeepSeek-V3', name: 'DeepSeek V3', icon: 'deepseek', enabled: true, contextLength: 131_072, maxOutputTokens: 8_192, supportsVision: false, supportsFunctionCall: true, supportsThinking: true, thinkingConfig: { bodyParams: { enable_thinking: true } } },
    { id: 'DeepSeek-R1', name: 'DeepSeek R1', icon: 'deepseek', enabled: true, contextLength: 131_072, maxOutputTokens: 8_192, supportsVision: false, supportsFunctionCall: false },
    // ── Qwen ──
    { id: 'Qwen3-235B-A22B', name: 'Qwen3 235B', icon: 'qwen', enabled: true, contextLength: 131_072, maxOutputTokens: 32_768, supportsVision: false, supportsFunctionCall: true, supportsThinking: true, thinkingConfig: { bodyParams: { enable_thinking: true } } },
    { id: 'Qwen3-30B-A3B', name: 'Qwen3 30B-A3B', icon: 'qwen', enabled: true, contextLength: 131_072, maxOutputTokens: 32_768, supportsVision: false, supportsFunctionCall: true, supportsThinking: true, thinkingConfig: { bodyParams: { enable_thinking: true } } },
    { id: 'Qwen3-8B', name: 'Qwen3 8B', icon: 'qwen', enabled: true, contextLength: 131_072, maxOutputTokens: 32_768, supportsVision: false, supportsFunctionCall: true, supportsThinking: true, thinkingConfig: { bodyParams: { enable_thinking: true } } },
    // ── GLM (智谱) ──
    { id: 'GLM-4.5', name: 'GLM-4.5', icon: 'chatglm', enabled: true, contextLength: 131_072, maxOutputTokens: 8_192, supportsVision: false, supportsFunctionCall: true },
    { id: 'GLM-4.5-Air', name: 'GLM-4.5 Air', icon: 'chatglm', enabled: true, contextLength: 131_072, maxOutputTokens: 8_192, supportsVision: false, supportsFunctionCall: true },
    // ── Moonshot / Kimi ──
    { id: 'Kimi-K2-Instruct', name: 'Kimi K2 Instruct', icon: 'kimi', enabled: true, contextLength: 131_072, maxOutputTokens: 8_192, supportsVision: false, supportsFunctionCall: true },
    // ── MiniMax ──
    { id: 'MiniMax-M2.1', name: 'MiniMax M2.1', icon: 'minimax', enabled: true, contextLength: 196_608, maxOutputTokens: 16_384, supportsVision: false, supportsFunctionCall: true },
    // ── 其他 ──
    { id: 'ERNIE-4.5-300B-A47B', name: 'ERNIE 4.5 300B', icon: 'ernie', enabled: true, contextLength: 131_072, maxOutputTokens: 8_192, supportsVision: false, supportsFunctionCall: true },
    { id: 'Hunyuan-A13B-Instruct', name: 'Hunyuan A13B', icon: 'hunyuan', enabled: true, contextLength: 131_072, maxOutputTokens: 8_192, supportsVision: false, supportsFunctionCall: true },
  ],
}
