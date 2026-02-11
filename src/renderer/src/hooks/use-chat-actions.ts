import { useCallback } from 'react'
import { nanoid } from 'nanoid'
import { toast } from 'sonner'
import { useChatStore } from '@renderer/stores/chat-store'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { useProviderStore } from '@renderer/stores/provider-store'
import { useAgentStore } from '@renderer/stores/agent-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { runAgentLoop } from '@renderer/lib/agent/agent-loop'
import { toolRegistry } from '@renderer/lib/agent/tool-registry'
import { buildSystemPrompt } from '@renderer/lib/agent/system-prompt'
import { subAgentEvents } from '@renderer/lib/agent/sub-agents/events'
import { abortAllTeammates } from '@renderer/lib/agent/teams/teammate-runner'
import { TEAM_TOOL_NAMES } from '@renderer/lib/agent/teams/register'
import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { createProvider } from '@renderer/lib/api/provider'
import { generateSessionTitle } from '@renderer/lib/api/generate-title'
import type { UnifiedMessage, ProviderConfig, TokenUsage, RequestDebugInfo, ContentBlock } from '@renderer/lib/api/types'
import { setLastDebugInfo } from '@renderer/lib/debug-store'
import type { ImageAttachment } from '@renderer/components/chat/InputArea'
import type { AgentLoopConfig } from '@renderer/lib/agent/types'
import { ApiStreamError } from '@renderer/lib/ipc/api-stream'

/** Per-session abort controllers — module-level so concurrent sessions don't overwrite each other */
const sessionAbortControllers = new Map<string, AbortController>()

export function useChatActions() {
  const sendMessage = useCallback(async (text: string, images?: ImageAttachment[]) => {
    const chatStore = useChatStore.getState()
    const settings = useSettingsStore.getState()
    const agentStore = useAgentStore.getState()
    const uiStore = useUIStore.getState()

    // Build provider config from provider-store (new system) with fallback to settings-store
    const providerConfig = useProviderStore.getState().getActiveProviderConfig()
    const effectiveMaxTokens = useProviderStore.getState().getEffectiveMaxTokens(settings.maxTokens)
    const activeModelThinkingConfig = useProviderStore.getState().getActiveModelThinkingConfig()
    const thinkingEnabled = settings.thinkingEnabled && !!activeModelThinkingConfig
    const baseProviderConfig: ProviderConfig | null = providerConfig
      ? {
        ...providerConfig,
        maxTokens: effectiveMaxTokens,
        temperature: settings.temperature,
        systemPrompt: settings.systemPrompt || undefined,
        thinkingEnabled,
        thinkingConfig: activeModelThinkingConfig,
      }
      : settings.apiKey
        ? {
          type: settings.provider,
          apiKey: settings.apiKey,
          baseUrl: settings.baseUrl || undefined,
          model: settings.model,
          maxTokens: effectiveMaxTokens,
          temperature: settings.temperature,
          systemPrompt: settings.systemPrompt || undefined,
          thinkingEnabled,
          thinkingConfig: activeModelThinkingConfig,
        }
        : null

    if (!baseProviderConfig || !baseProviderConfig.apiKey) {
      toast.error('API key required', {
        description: 'Please configure an AI provider in Settings',
        action: { label: 'Open Settings', onClick: () => uiStore.openSettingsPage('provider') },
      })
      return
    }

    // Ensure we have an active session
    let sessionId = chatStore.activeSessionId
    if (!sessionId) {
      sessionId = chatStore.createSession(uiStore.mode)
    }

    // Add user message (multi-modal when images attached)
    const userContent: string | ContentBlock[] = images && images.length > 0
      ? [
          ...images.map((img) => {
            const base64 = img.dataUrl.replace(/^data:[^;]+;base64,/, '')
            return {
              type: 'image' as const,
              source: { type: 'base64' as const, mediaType: img.mediaType, data: base64 },
            }
          }),
          ...(text ? [{ type: 'text' as const, text }] : []),
        ]
      : text
    const userMsg: UnifiedMessage = {
      id: nanoid(),
      role: 'user',
      content: userContent,
      createdAt: Date.now(),
    }
    chatStore.addMessage(sessionId, userMsg)

    // Auto-title: fire-and-forget AI title + icon generation for the first message
    const session = useChatStore.getState().sessions.find((s) => s.id === sessionId)
    if (session && session.title === 'New Conversation') {
      const capturedSessionId = sessionId
      generateSessionTitle(text).then((result) => {
        if (result) {
          const store = useChatStore.getState()
          store.updateSessionTitle(capturedSessionId, result.title)
          store.updateSessionIcon(capturedSessionId, result.icon)
        }
      }).catch(() => { /* keep default title on failure */ })
    }

    // Create assistant placeholder message
    const assistantMsgId = nanoid()
    const assistantMsg: UnifiedMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
    }
    chatStore.addMessage(sessionId, assistantMsg)
    chatStore.setStreamingMessageId(sessionId, assistantMsgId)

    // Setup abort controller (per-session)
    // If this session already has a running agent, abort it first
    const existingAc = sessionAbortControllers.get(sessionId)
    if (existingAc) existingAc.abort()
    const abortController = new AbortController()
    sessionAbortControllers.set(sessionId, abortController)

    const mode = uiStore.mode

    if (mode === 'chat') {
      // Simple chat mode: single API call, no tools
      const chatSystemPrompt = [
        'You are OpenCowork, a helpful AI assistant. Be concise, accurate, and friendly.',
        'Before responding, follow this thinking process: (1) Understand — identify what the user truly needs, not just the literal words; consider context and implicit constraints. (2) Expand — think about the best way to solve the problem, consider edge cases, potential pitfalls, and better alternatives the user may not have thought of. (3) Validate — before finalizing, verify your answer is logically consistent: does it actually help the user achieve their stated goal? Check the full causal chain — if the user follows your advice, will they accomplish what they want? Watch for hidden contradictions (e.g. if someone needs to wash their car, they must bring the car — suggesting they walk defeats the purpose). (4) Respond — deliver a well-reasoned, logically sound answer that best fits the user\'s real needs. Think first, answer second — never rush to conclusions.',
        'CRITICAL RULE: Before giving your final answer, always ask yourself: "If the user follows my advice step by step, will they actually achieve their stated goal?" If the answer is no, your response has a logical flaw — stop and reconsider. The user\'s goal defines the constraints; never give advice that makes the goal impossible.',
        'Use markdown formatting in your responses. Use code blocks with language identifiers for code.',
        settings.systemPrompt ? `\n## Additional Instructions\n${settings.systemPrompt}` : '',
      ].filter(Boolean).join('\n')
      // NOTE: thinkingEnabled is handled below when building the final config
      const chatConfig: ProviderConfig = { ...baseProviderConfig, systemPrompt: chatSystemPrompt }
      agentStore.setSessionStatus(sessionId, 'running')
      try {
        await runSimpleChat(sessionId, assistantMsgId, chatConfig, abortController.signal)
      } finally {
        agentStore.setSessionStatus(sessionId, 'completed')
        sessionAbortControllers.delete(sessionId)
      }
    } else {
      // Cowork / Code mode: agent loop with tools
      const session = useChatStore.getState().sessions.find((s) => s.id === sessionId)
      // Load available skills from ~/.open-cowork/skills/
      const skills = await ipcClient.invoke('skills:list') as { name: string; description: string }[]

      // Filter out team tools when the feature is disabled
      const allToolDefs = toolRegistry.getDefinitions()
      const effectiveToolDefs = settings.teamToolsEnabled
        ? allToolDefs
        : allToolDefs.filter((t) => !TEAM_TOOL_NAMES.has(t.name))

      const agentSystemPrompt = buildSystemPrompt({
        mode: mode as 'cowork' | 'code',
        workingFolder: session?.workingFolder,
        userSystemPrompt: settings.systemPrompt || undefined,
        skills: Array.isArray(skills) ? skills : [],
        toolDefs: effectiveToolDefs,
      })
      const agentProviderConfig: ProviderConfig = {
        ...baseProviderConfig,
        systemPrompt: agentSystemPrompt,
      }
      const loopConfig: AgentLoopConfig = {
        maxIterations: 20,
        provider: agentProviderConfig,
        tools: effectiveToolDefs,
        systemPrompt: agentSystemPrompt,
        workingFolder: session?.workingFolder,
        signal: abortController.signal,
      }

      agentStore.setRunning(true)
      agentStore.setSessionStatus(sessionId, 'running')
      agentStore.clearToolCalls()

      // Accumulate usage across all iterations + SubAgent runs
      const accumulatedUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 }

      // Subscribe to SubAgent events during agent loop
      const unsubSubAgent = subAgentEvents.on((event) => {
        useAgentStore.getState().handleSubAgentEvent(event)
        // Accumulate SubAgent token usage into the parent message
        if (event.type === 'sub_agent_end' && event.result?.usage) {
          mergeUsage(accumulatedUsage, event.result.usage)
          useChatStore.getState().updateMessage(sessionId!, assistantMsgId, { usage: { ...accumulatedUsage } })
        }
      })

      // NOTE: Team events are handled by a persistent global subscription
      // in register.ts — not scoped here, because teammate loops outlive the lead's loop.

      // Request notification permission on first agent run
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => { })
      }

      try {
        const messages = useChatStore.getState().getSessionMessages(sessionId)
        const loop = runAgentLoop(
          messages.slice(0, -1), // Exclude the empty assistant placeholder
          loopConfig,
          { workingFolder: session?.workingFolder, signal: abortController.signal, ipc: ipcClient },
          async (tc) => {
            const autoApprove = useSettingsStore.getState().autoApprove
            if (autoApprove) return true
            // Per-session tool approval memory: skip re-approval for previously approved tools
            const approved = useAgentStore.getState().approvedToolNames
            if (approved.includes(tc.name)) return true
            const result = await agentStore.requestApproval(tc.id)
            if (result) useAgentStore.getState().addApprovedTool(tc.name)
            return result
          }
        )

        let thinkingDone = false
        for await (const event of loop) {
          if (abortController.signal.aborted) break

          switch (event.type) {
            case 'thinking_delta':
              useChatStore.getState().appendThinkingDelta(sessionId!, assistantMsgId, event.thinking)
              break

            case 'text_delta':
              if (!thinkingDone) { thinkingDone = true; useChatStore.getState().completeThinking(sessionId!, assistantMsgId) }
              useChatStore.getState().appendTextDelta(sessionId!, assistantMsgId, event.text)
              break

            case 'tool_use_streaming_start':
              if (!thinkingDone) { thinkingDone = true; useChatStore.getState().completeThinking(sessionId!, assistantMsgId) }
              // Immediately show tool card with name while args are still streaming
              useChatStore.getState().appendToolUse(sessionId!, assistantMsgId, {
                type: 'tool_use',
                id: event.toolCallId,
                name: event.toolName,
                input: {},
              })
              useAgentStore.getState().addToolCall({
                id: event.toolCallId,
                name: event.toolName,
                input: {},
                status: 'streaming',
                requiresApproval: false,
              })
              break

            case 'tool_use_args_delta':
              // Real-time partial args update via partial-json parsing
              useChatStore.getState().updateToolUseInput(
                sessionId!, assistantMsgId,
                event.toolCallId, event.partialInput,
              )
              useAgentStore.getState().updateToolCall(event.toolCallId, {
                input: event.partialInput,
              })
              break

            case 'tool_use_generated':
              // Args fully streamed — update the existing block's input (final)
              useChatStore.getState().updateToolUseInput(
                sessionId!, assistantMsgId,
                event.toolUseBlock.id, event.toolUseBlock.input,
              )
              useAgentStore.getState().updateToolCall(event.toolUseBlock.id, {
                input: event.toolUseBlock.input,
              })
              break

            case 'tool_call_start':
              useAgentStore.getState().addToolCall(event.toolCall)
              break

            case 'tool_call_approval_needed': {
              // Skip adding to pendingToolCalls when auto-approve is active —
              // the callback will return true immediately, so no dialog needed.
              const willAutoApprove = useSettingsStore.getState().autoApprove ||
                useAgentStore.getState().approvedToolNames.includes(event.toolCall.name)
              if (!willAutoApprove) {
                useAgentStore.getState().addToolCall(event.toolCall)
              }
              break
            }

            case 'tool_call_result':
              useAgentStore.getState().updateToolCall(event.toolCall.id, {
                status: event.toolCall.status,
                output: event.toolCall.output,
                error: event.toolCall.error,
                completedAt: event.toolCall.completedAt,
              })
              break

            case 'iteration_end':
              // Reset so the next iteration's thinking block gets properly completed
              thinkingDone = false
              // When an iteration ends with tool results, append tool_result user message.
              // The next iteration's text/tool_use will continue appending to the same assistant message.
              if (event.toolResults && event.toolResults.length > 0) {
                const toolResultMsg: UnifiedMessage = {
                  id: nanoid(),
                  role: 'user',
                  content: event.toolResults.map((tr) => ({
                    type: 'tool_result' as const,
                    toolUseId: tr.toolUseId,
                    content: tr.content,
                    isError: tr.isError,
                  })),
                  createdAt: Date.now(),
                }
                useChatStore.getState().addMessage(sessionId!, toolResultMsg)
              }
              break

            case 'message_end':
              if (!thinkingDone) { thinkingDone = true; useChatStore.getState().completeThinking(sessionId!, assistantMsgId) }
              if (event.usage) {
                mergeUsage(accumulatedUsage, event.usage)
                // contextTokens = last API call's input tokens (overwrite, not accumulate)
                accumulatedUsage.contextTokens = event.usage.inputTokens
                useChatStore.getState().updateMessage(sessionId!, assistantMsgId, { usage: { ...accumulatedUsage } })
              }
              break

            case 'request_debug':
              if (useSettingsStore.getState().devMode && event.debugInfo) {
                setLastDebugInfo(assistantMsgId, event.debugInfo)
              }
              break

            case 'error':
              console.error('[Agent Loop Error]', event.error)
              toast.error('Agent Error', { description: event.error.message })
              break
          }
        }
      } catch (err) {
        console.error('[Agent Loop Exception]', err)
        if (!abortController.signal.aborted) {
          const errMsg = err instanceof Error ? err.message : String(err)
          console.error('[Agent Loop Exception]', err)
          toast.error('Agent failed', { description: errMsg })
          useChatStore.getState().appendTextDelta(sessionId!, assistantMsgId, `\n\n> **Error:** ${errMsg}`)
          if (err instanceof ApiStreamError && useSettingsStore.getState().devMode) {
            setLastDebugInfo(assistantMsgId, err.debugInfo as RequestDebugInfo)
          }
        }
      } finally {
        unsubSubAgent()
        agentStore.setSessionStatus(sessionId, 'completed')
        chatStore.setStreamingMessageId(sessionId, null)
        sessionAbortControllers.delete(sessionId)
        // Derive global isRunning from remaining running sessions
        const hasOtherRunning = Object.values(useAgentStore.getState().runningSessions).some((s) => s === 'running')
        agentStore.setRunning(hasOtherRunning)
        // Notify when agent finishes and window is not focused
        if (!document.hasFocus() && Notification.permission === 'granted') {
          new Notification('OpenCowork', { body: 'Agent finished working', silent: true })
        }
      }
    }
  }, [])

  const stopStreaming = useCallback(() => {
    // Stop the active session's agent
    const activeId = useChatStore.getState().activeSessionId
    if (activeId) {
      const ac = sessionAbortControllers.get(activeId)
      if (ac) {
        ac.abort()
        sessionAbortControllers.delete(activeId)
      }
      useChatStore.getState().setStreamingMessageId(activeId, null)
      useAgentStore.getState().setSessionStatus(activeId, null)
    }
    // Only do global abort (which denies ALL pending approvals) when
    // no other sessions are still running — prevents cross-session interference.
    const otherRunning = Object.entries(useAgentStore.getState().runningSessions)
      .some(([id, s]) => id !== activeId && s === 'running')
    if (!otherRunning) {
      useAgentStore.getState().setRunning(false)
      useAgentStore.getState().abort()
    }
    // Also stop all running teammate agent loops
    abortAllTeammates()
  }, [])

  const retryLastMessage = useCallback(async () => {
    const chatStore = useChatStore.getState()
    const sessionId = chatStore.activeSessionId
    if (!sessionId) return
    const lastUserText = chatStore.removeLastAssistantMessage(sessionId)
    if (lastUserText) {
      // Also remove the last user message — sendMessage will re-add it
      chatStore.removeLastUserMessage(sessionId)
      await sendMessage(lastUserText)
    }
  }, [sendMessage])

  const editAndResend = useCallback(async (newContent: string) => {
    const chatStore = useChatStore.getState()
    const sessionId = chatStore.activeSessionId
    if (!sessionId) return
    const messages = chatStore.getSessionMessages(sessionId)
    // Find the last real user message (has text content, not just tool_result blocks)
    let editIdx = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.role === 'user') {
        if (typeof m.content === 'string') { editIdx = i; break }
        if (m.content.some((b) => b.type === 'text')) { editIdx = i; break }
      }
    }
    if (editIdx < 0) return
    // Truncate from the edited message onward (removes it + all subsequent messages)
    chatStore.truncateMessagesFrom(sessionId, editIdx)
    // Re-send with edited content
    await sendMessage(newContent)
  }, [sendMessage])

  return { sendMessage, stopStreaming, retryLastMessage, editAndResend }
}

/**
 * Simple chat mode: single API call with streaming text, no tools.
 */
async function runSimpleChat(
  sessionId: string,
  assistantMsgId: string,
  config: ProviderConfig,
  signal: AbortSignal
): Promise<void> {
  const provider = createProvider(config)
  const chatStore = useChatStore.getState()
  const messages = chatStore.getSessionMessages(sessionId)

  try {
    const stream = provider.sendMessage(
      messages.slice(0, -1), // Exclude empty assistant placeholder
      [], // No tools in chat mode
      config,
      signal
    )

    let thinkingDone = false
    for await (const event of stream) {
      if (signal.aborted) break

      switch (event.type) {
        case 'thinking_delta':
          useChatStore.getState().appendThinkingDelta(sessionId, assistantMsgId, event.thinking!)
          break
        case 'text_delta':
          if (!thinkingDone) { thinkingDone = true; useChatStore.getState().completeThinking(sessionId, assistantMsgId) }
          useChatStore.getState().appendTextDelta(sessionId, assistantMsgId, event.text!)
          break
        case 'message_end':
          if (!thinkingDone) { thinkingDone = true; useChatStore.getState().completeThinking(sessionId, assistantMsgId) }
          if (event.usage) {
            useChatStore.getState().updateMessage(sessionId, assistantMsgId, { usage: { ...event.usage, contextTokens: event.usage.inputTokens } })
          }
          break
        case 'request_debug':
          if (useSettingsStore.getState().devMode && event.debugInfo) {
            setLastDebugInfo(assistantMsgId, event.debugInfo)
          }
          break
        case 'error':
          console.error('[Chat Error]', event.error)
          toast.error('Chat Error', { description: event.error?.message ?? 'Unknown error' })
          break
      }
    }
  } catch (err) {
    if (!signal.aborted) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error('[Chat Exception]', err)
      toast.error('Chat failed', { description: errMsg })
      useChatStore.getState().appendTextDelta(sessionId, assistantMsgId, `\n\n> **Error:** ${errMsg}`)
      if (err instanceof ApiStreamError && useSettingsStore.getState().devMode) {
        setLastDebugInfo(assistantMsgId, err.debugInfo as RequestDebugInfo)
      }
    }
  } finally {
    useChatStore.getState().setStreamingMessageId(sessionId, null)
  }
}

/**
 * Merge incoming TokenUsage into an accumulator (mutates target).
 * Sums inputTokens, outputTokens, and optional cache/reasoning fields.
 */
function mergeUsage(target: TokenUsage, incoming: TokenUsage): void {
  target.inputTokens += incoming.inputTokens
  target.outputTokens += incoming.outputTokens
  if (incoming.cacheCreationTokens) {
    target.cacheCreationTokens = (target.cacheCreationTokens ?? 0) + incoming.cacheCreationTokens
  }
  if (incoming.cacheReadTokens) {
    target.cacheReadTokens = (target.cacheReadTokens ?? 0) + incoming.cacheReadTokens
  }
  if (incoming.reasoningTokens) {
    target.reasoningTokens = (target.reasoningTokens ?? 0) + incoming.reasoningTokens
  }
}
