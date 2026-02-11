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

class OpenAIResponsesProvider implements APIProvider {
  readonly name = 'OpenAI Responses'
  readonly type = 'openai-responses' as const

  async *sendMessage(
    messages: UnifiedMessage[],
    tools: ToolDefinition[],
    config: ProviderConfig,
    signal?: AbortSignal
  ): AsyncIterable<StreamEvent> {
    const body: Record<string, unknown> = {
      model: config.model,
      input: this.formatMessages(messages, config.systemPrompt),
      stream: true,
    }

    if (tools.length > 0) {
      body.tools = this.formatTools(tools)
    }
    if (config.temperature !== undefined) body.temperature = config.temperature
    if (config.maxTokens) body.max_tokens = config.maxTokens

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
    const url = `${baseUrl}/responses`

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    }
    const bodyStr = JSON.stringify(body)

    // Yield debug info for dev mode inspection
    yield { type: 'request_debug', debugInfo: { url, method: 'POST', headers: maskHeaders(headers), body: bodyStr, timestamp: Date.now() } }

    const argBuffers = new Map<string, string>()

    for await (const sse of ipcStreamRequest({
      url,
      method: 'POST',
      headers,
      body: bodyStr,
      signal,
    })) {
      if (!sse.data || sse.data === '[DONE]') continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any
      try {
        data = JSON.parse(sse.data)
      } catch {
        continue
      }

      switch (sse.event) {
        case 'response.output_text.delta':
          yield { type: 'text_delta', text: data.delta }
          break

        case 'response.output_item.added':
          if (data.item.type === 'function_call') {
            argBuffers.set(data.item.id, '')
            yield {
              type: 'tool_call_start',
              toolCallId: data.item.call_id,
              toolName: data.item.name,
            }
          }
          break

        case 'response.function_call_arguments.delta': {
          yield { type: 'tool_call_delta', argumentsDelta: data.delta }
          const key = data.item_id
          argBuffers.set(key, (argBuffers.get(key) ?? '') + data.delta)
          break
        }

        case 'response.function_call_arguments.done':
          try {
            yield { type: 'tool_call_end', toolCallId: data.call_id, toolName: data.name, toolCallInput: JSON.parse(data.arguments) }
          } catch {
            yield { type: 'tool_call_end', toolCallId: data.call_id, toolName: data.name, toolCallInput: {} }
          }
          break

        case 'response.completed':
          yield {
            type: 'message_end',
            stopReason: data.response.status,
            usage: data.response.usage
              ? {
                  inputTokens: data.response.usage.input_tokens ?? 0,
                  outputTokens: data.response.usage.output_tokens ?? 0,
                  ...(data.response.usage.output_tokens_details?.reasoning_tokens
                    ? { reasoningTokens: data.response.usage.output_tokens_details.reasoning_tokens }
                    : {}),
                }
              : undefined,
          }
          break

        case 'response.failed':
        case 'error':
          yield { type: 'error', error: { type: 'api_error', message: JSON.stringify(data) } }
          break
      }
    }
  }

  formatMessages(messages: UnifiedMessage[], systemPrompt?: string): unknown[] {
    const input: unknown[] = []

    if (systemPrompt) {
      input.push({ type: 'message', role: 'developer', content: systemPrompt })
    }

    for (const m of messages) {
      if (m.role === 'system') continue

      if (typeof m.content === 'string') {
        input.push({ type: 'message', role: m.role, content: m.content })
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
              parts.push({ type: 'input_image', image_url: url })
            } else if (b.type === 'text') {
              parts.push({ type: 'input_text', text: b.text })
            }
          }
          input.push({ type: 'message', role: 'user', content: parts })
          continue
        }
      }

      for (const block of blocks) {
        switch (block.type) {
          case 'text':
            input.push({ type: 'message', role: m.role, content: block.text })
            break
          case 'tool_use':
            input.push({
              type: 'function_call',
              call_id: block.id,
              name: block.name,
              arguments: JSON.stringify(block.input),
              status: 'completed',
            })
            break
          case 'tool_result': {
            // OpenAI Responses API function_call_output only supports string output
            let output: string
            if (Array.isArray(block.content)) {
              const textParts = block.content.filter((cb) => cb.type === 'text').map((cb) => cb.type === 'text' ? cb.text : '')
              const imageParts = block.content.filter((cb) => cb.type === 'image')
              output = [
                ...textParts,
                ...imageParts.map(() => '[Image attached]'),
              ].join('\n') || '[Image]'
            } else {
              output = block.content
            }
            input.push({
              type: 'function_call_output',
              call_id: block.toolUseId,
              output,
            })
            break
          }
        }
      }
    }

    return input
  }

  formatTools(tools: ToolDefinition[]): unknown[] {
    return tools.map((t) => ({
      type: 'function',
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
      strict: false,
    }))
  }
}

export function registerOpenAIResponsesProvider(): void {
  registerProvider('openai-responses', () => new OpenAIResponsesProvider())
}
