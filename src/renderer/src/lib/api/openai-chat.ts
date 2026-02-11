import type {
  APIProvider,
  ProviderConfig,
  StreamEvent,
  ToolDefinition,
  UnifiedMessage,
  ContentBlock,
} from './types'
import { ipcStreamRequest, maskHeaders } from '../ipc/api-stream'
import { registerProvider } from './provider'

class OpenAIChatProvider implements APIProvider {
  readonly name = 'OpenAI Chat Completions'
  readonly type = 'openai-chat' as const

  async *sendMessage(
    messages: UnifiedMessage[],
    tools: ToolDefinition[],
    config: ProviderConfig,
    signal?: AbortSignal
  ): AsyncIterable<StreamEvent> {
    const body: Record<string, unknown> = {
      model: config.model,
      messages: this.formatMessages(messages, config.systemPrompt),
      stream: true,
      stream_options: { include_usage: true },
    }

    if (tools.length > 0) {
      body.tools = this.formatTools(tools)
      body.tool_choice = 'auto'
    }
    if (config.temperature !== undefined) body.temperature = config.temperature
    if (config.maxTokens) {
      // OpenAI o-series reasoning models use max_completion_tokens instead of max_tokens
      const isReasoningModel = /^(o[1-9]|o\d+-mini)/.test(config.model)
      if (isReasoningModel) {
        body.max_completion_tokens = config.maxTokens
      } else {
        body.max_tokens = config.maxTokens
      }
    }

    // Merge thinking/reasoning params when enabled; explicit disable params when off
    if (config.thinkingEnabled && config.thinkingConfig) {
      Object.assign(body, config.thinkingConfig.bodyParams)
      if (config.thinkingConfig.forceTemperature !== undefined) {
        body.temperature = config.thinkingConfig.forceTemperature
      }
    } else if (!config.thinkingEnabled && config.thinkingConfig?.disabledBodyParams) {
      Object.assign(body, config.thinkingConfig.disabledBodyParams)
    }

    const baseUrl = (config.baseUrl || 'https://api.openai.com/v1').trim().replace(/\/+$/, '')
    const url = `${baseUrl}/chat/completions`

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    }
    const bodyStr = JSON.stringify(body)

    // Yield debug info for dev mode inspection
    yield { type: 'request_debug', debugInfo: { url, method: 'POST', headers: maskHeaders(headers), body: bodyStr, timestamp: Date.now() } }

    const toolBuffers = new Map<number, { id: string; name: string; args: string }>()

    for await (const sse of ipcStreamRequest({
      url,
      method: 'POST',
      headers,
      body: bodyStr,
      signal,
    })) {
      if (!sse.data || sse.data === '[DONE]') break
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any
      try {
        data = JSON.parse(sse.data)
      } catch {
        continue
      }
      const choice = data.choices?.[0]

      if (!choice) {
        if (data.usage) {
          yield {
            type: 'message_end',
            usage: {
              inputTokens: data.usage.prompt_tokens ?? 0,
              outputTokens: data.usage.completion_tokens ?? 0,
              ...(data.usage.completion_tokens_details?.reasoning_tokens
                ? { reasoningTokens: data.usage.completion_tokens_details.reasoning_tokens }
                : {}),
            },
          }
        }
        continue
      }

      const delta = choice.delta

      if (delta?.reasoning_content) {
        yield { type: 'thinking_delta', thinking: delta.reasoning_content }
      }

      if (delta?.content) {
        yield { type: 'text_delta', text: delta.content }
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0

          let buf = toolBuffers.get(idx)

          if (!buf) {
            buf = { id: tc.id ?? '', name: tc.function?.name ?? '', args: '' }
            toolBuffers.set(idx, buf)
            if (tc.id) {
              yield { type: 'tool_call_start', toolCallId: tc.id, toolName: tc.function?.name }
            }
          } else {
            if (tc.id && !buf.id) {
              buf.id = tc.id
              yield { type: 'tool_call_start', toolCallId: tc.id, toolName: buf.name || tc.function?.name }
            }
            if (tc.function?.name && !buf.name) buf.name = tc.function.name
          }

          if (tc.function?.arguments) {
            buf.args += tc.function.arguments
            yield { type: 'tool_call_delta', argumentsDelta: tc.function.arguments }
          }
        }
      }

      if (choice.finish_reason === 'tool_calls' || choice.finish_reason === 'function_call') {
        for (const [, buf] of toolBuffers) {
          if (!buf.id) continue
          try {
            yield { type: 'tool_call_end', toolCallId: buf.id, toolName: buf.name, toolCallInput: JSON.parse(buf.args) }
          } catch {
            yield { type: 'tool_call_end', toolCallId: buf.id, toolName: buf.name, toolCallInput: {} }
          }
        }
        toolBuffers.clear()
      }

      if (choice.finish_reason === 'stop') {
        // Some providers include usage in the same chunk as finish_reason:'stop'
        yield {
          type: 'message_end',
          stopReason: 'stop',
          ...(data.usage ? {
            usage: {
              inputTokens: data.usage.prompt_tokens ?? 0,
              outputTokens: data.usage.completion_tokens ?? 0,
              ...(data.usage.completion_tokens_details?.reasoning_tokens
                ? { reasoningTokens: data.usage.completion_tokens_details.reasoning_tokens }
                : {}),
            },
          } : {}),
        }
      }
    }

    // Flush remaining tool buffers for providers that don't send finish_reason:'tool_calls'
    if (toolBuffers.size > 0) {
      for (const [, buf] of toolBuffers) {
        if (!buf.id) continue
        try {
          yield { type: 'tool_call_end', toolCallId: buf.id, toolName: buf.name, toolCallInput: JSON.parse(buf.args) }
        } catch {
          yield { type: 'tool_call_end', toolCallId: buf.id, toolName: buf.name, toolCallInput: {} }
        }
      }
      toolBuffers.clear()
    }
  }

  formatMessages(messages: UnifiedMessage[], systemPrompt?: string): unknown[] {
    const formatted: unknown[] = []

    if (systemPrompt) {
      formatted.push({ role: 'system', content: systemPrompt })
    }

    for (const m of messages) {
      if (m.role === 'system') continue

      if (typeof m.content === 'string') {
        formatted.push({ role: m.role, content: m.content })
        continue
      }

      const blocks = m.content as ContentBlock[]

      // Handle user messages with images → multi-part content
      if (m.role === 'user') {
        const hasImages = blocks.some((b) => b.type === 'image')
        if (hasImages) {
          const parts: unknown[] = []
          for (const b of blocks) {
            if (b.type === 'image') {
              const url = b.source.type === 'base64'
                ? `data:${b.source.mediaType || 'image/png'};base64,${b.source.data}`
                : b.source.url || ''
              parts.push({ type: 'image_url', image_url: { url } })
            } else if (b.type === 'text') {
              parts.push({ type: 'text', text: b.text })
            }
          }
          formatted.push({ role: 'user', content: parts })
          continue
        }
      }

      // Handle tool results → role: "tool"
      const toolResults = blocks.filter((b) => b.type === 'tool_result')
      if (toolResults.length > 0) {
        for (const tr of toolResults) {
          if (tr.type === 'tool_result') {
            if (Array.isArray(tr.content)) {
              const parts: unknown[] = []
              for (const cb of tr.content) {
                if (cb.type === 'text') {
                  parts.push({ type: 'text', text: cb.text })
                } else if (cb.type === 'image') {
                  const dataUrl = `data:${cb.source.mediaType || 'image/png'};base64,${cb.source.data}`
                  parts.push({ type: 'image_url', image_url: { url: dataUrl } })
                }
              }
              formatted.push({ role: 'tool', tool_call_id: tr.toolUseId, content: parts })
            } else {
              formatted.push({ role: 'tool', tool_call_id: tr.toolUseId, content: tr.content })
            }
          }
        }
        continue
      }

      // Handle assistant with tool_use blocks
      const toolUses = blocks.filter((b) => b.type === 'tool_use')
      const textBlocks = blocks.filter((b) => b.type === 'text')
      const thinkingBlocks = blocks.filter((b) => b.type === 'thinking')
      const textContent = textBlocks.map((b) => (b.type === 'text' ? b.text : '')).join('')
      const reasoningContent = thinkingBlocks.map((b) => (b.type === 'thinking' ? b.thinking : '')).join('')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg: any = { role: 'assistant', content: textContent || null }
      // Preserve reasoning context for models that support it (DeepSeek R1, QwQ, etc.)
      if (reasoningContent) msg.reasoning_content = reasoningContent

      if (toolUses.length > 0) {
        msg.tool_calls = toolUses.map((tu) => {
          if (tu.type !== 'tool_use') return null
          return {
            id: tu.id,
            type: 'function',
            function: { name: tu.name, arguments: JSON.stringify(tu.input) },
          }
        }).filter(Boolean)
      }
      formatted.push(msg)
    }

    return formatted
  }

  formatTools(tools: ToolDefinition[]): unknown[] {
    return tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }))
  }
}

export function registerOpenAIChatProvider(): void {
  registerProvider('openai-chat', () => new OpenAIChatProvider())
}
