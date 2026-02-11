import { useSettingsStore } from '@renderer/stores/settings-store'
import { useProviderStore } from '@renderer/stores/provider-store'
import { createProvider } from './provider'
import type { ProviderConfig, UnifiedMessage } from './types'
import { SESSION_ICONS_PROMPT_LIST } from '@renderer/lib/constants/session-icons'

export interface SessionTitleResult {
  title: string
  icon: string
}

const TITLE_SYSTEM_PROMPT = `You are a title generator. Given a user message, produce:
1. A concise title (max 30 characters) that summarizes the intent.
2. Pick ONE icon name from the following Lucide icon list that best represents the topic:
${SESSION_ICONS_PROMPT_LIST}

Reply with ONLY a JSON object in this exact format (no markdown, no explanation):
{"title":"your title here","icon":"icon-name"}`

/**
 * Use the fast model to generate a short session title from the user's first message.
 * Runs in the background — does not block the main chat flow.
 * Returns { title, icon } or null on failure.
 */
export async function generateSessionTitle(userMessage: string): Promise<SessionTitleResult | null> {
  const settings = useSettingsStore.getState()

  // Try provider-store fast model config first, then fall back to settings-store
  const fastConfig = useProviderStore.getState().getFastProviderConfig()
  const config: ProviderConfig | null = fastConfig
    ? {
        ...fastConfig,
        maxTokens: 100,
        temperature: 0.3,
        systemPrompt: TITLE_SYSTEM_PROMPT,
      }
    : settings.apiKey && settings.fastModel
      ? {
          type: settings.provider,
          apiKey: settings.apiKey,
          baseUrl: settings.baseUrl || undefined,
          model: settings.fastModel,
          maxTokens: 100,
          temperature: 0.3,
          systemPrompt: TITLE_SYSTEM_PROMPT,
        }
      : null

  if (!config || !config.apiKey) return null

  const messages: UnifiedMessage[] = [
    {
      id: 'title-req',
      role: 'user',
      content: userMessage.slice(0, 500),
      createdAt: Date.now(),
    },
  ]

  try {
    const provider = createProvider(config)
    const abortController = new AbortController()
    const timeout = setTimeout(() => abortController.abort(), 15000)

    let title = ''
    for await (const event of provider.sendMessage(messages, [], config, abortController.signal)) {
      if (event.type === 'text_delta' && event.text) {
        title += event.text
      }
    }
    clearTimeout(timeout)

    // Strip thinking tags, markdown fences, and surrounding whitespace
    const cleaned = title
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1')
      .trim()
    if (!cleaned) return null

    // Try to parse JSON response — use a non-greedy match scoped to a single object
    try {
      const jsonMatch = cleaned.match(/\{[^{}]*"title"\s*:\s*"[^"]*"[^{}]*\}/)
        ?? cleaned.match(/\{[\s\S]*?\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.title && parsed.icon) {
          let t = String(parsed.title).trim().replace(/^["']|["']$/g, '').trim()
          if (t.length > 40) t = t.slice(0, 40) + '...'
          return { title: t, icon: String(parsed.icon).trim() }
        }
      }
    } catch { /* fall through to plain-text fallback */ }

    // Fallback: treat entire response as title, use default icon
    let plainTitle = cleaned.replace(/^["']|["']$/g, '').replace(/[{}]/g, '').trim()
    if (plainTitle.length > 40) plainTitle = plainTitle.slice(0, 40) + '...'
    return { title: plainTitle, icon: 'message-square' }
  } catch {
    return null
  }
}
