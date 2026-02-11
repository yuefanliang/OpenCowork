import type { ToolHandler } from '../../tools/tool-types'
import type { SubAgentDefinition, SubAgentEvent } from './types'
import type { ToolCallState } from '../types'
import { runSubAgent } from './runner'
import { subAgentEvents } from './events'
import { subAgentRegistry } from './registry'
import type { ProviderConfig, TokenUsage } from '../../api/types'
import { useAgentStore } from '../../../stores/agent-store'
import { useSettingsStore } from '../../../stores/settings-store'
import { ConcurrencyLimiter } from '../concurrency-limiter'

/** Global concurrency limiter: at most 2 SubAgents run simultaneously. */
const subAgentLimiter = new ConcurrencyLimiter(2)

/** Metadata embedded in SubAgent output for historical rendering */
export interface SubAgentMeta {
  iterations: number
  elapsed: number
  usage: TokenUsage
  toolCalls: Array<{
    id: string
    name: string
    input: Record<string, unknown>
    status: string
    output?: string
    error?: string
    startedAt?: number
    completedAt?: number
  }>
}

const META_PREFIX = '<!--subagent-meta:'
const META_SUFFIX = '-->\n'

/** Extract embedded metadata from SubAgent output string */
export function parseSubAgentMeta(output: string): { meta: SubAgentMeta | null; text: string } {
  if (!output.startsWith(META_PREFIX)) return { meta: null, text: output }
  const endIdx = output.indexOf(META_SUFFIX)
  if (endIdx < 0) return { meta: null, text: output }
  try {
    const json = output.slice(META_PREFIX.length, endIdx)
    const meta = JSON.parse(json) as SubAgentMeta
    const text = output.slice(endIdx + META_SUFFIX.length)
    return { meta, text }
  } catch {
    return { meta: null, text: output }
  }
}

/** The unified Task tool name */
export const TASK_TOOL_NAME = 'Task'

/**
 * Build the description for the unified Task tool by embedding
 * all registered SubAgent names and descriptions.
 */
function buildTaskDescription(agents: SubAgentDefinition[]): string {
  const agentLines = agents
    .map((a) => `- **${a.name}**: ${a.description} (tools: ${a.allowedTools.join(', ')})`)
    .join('\n')

  return `Launch a specialized sub-agent to perform a focused task autonomously. The sub-agent runs its own agent loop with a restricted set of tools and returns a final report.

Available sub-agents (use the corresponding name as "subType"):
${agentLines}

When to use the Task tool:
- If you are searching for a keyword or file and are not confident that you will find the right match in the first few tries, use Task with subType "CodeSearch" to perform the search for you.
- If you need a code review, use Task with subType "CodeReview".
- If you need to plan a complex multi-file change, use Task with subType "Planner".

When NOT to use the Task tool:
- If you want to read a specific file path, use the Read or Glob tool instead, to find the match more quickly.
- If you are searching for a specific class definition like "class Foo", use the Glob tool instead.
- If you are searching for code within a specific file or set of 2-3 files, use the Read tool instead.
- Writing code and running bash commands (use other tools for that).

Usage notes:
1. Launch multiple tasks concurrently whenever possible, to maximize performance; to do that, use a single message with multiple tool uses.
2. When the sub-agent is done, it will return a single message back to you. The result returned by the sub-agent is not visible to the user. To show the user the result, you should send a text message back to the user with a concise summary of the result.
3. Each sub-agent invocation is stateless. You will not be able to send additional messages to the sub-agent, nor will the sub-agent be able to communicate with you outside of its final report. Therefore, your prompt should contain a highly detailed task description for the sub-agent to perform autonomously and you should specify exactly what information the sub-agent should return back to you in its final and only message to you.
4. The sub-agent's outputs should generally be trusted.
5. Clearly tell the sub-agent whether you expect it to write code or just to do research (search, file reads, web fetches, etc.), since it is not aware of the user's intent.`
}

/**
 * Creates a single unified "Task" ToolHandler that dispatches to
 * the appropriate SubAgent based on the "subType" parameter.
 *
 * The providerGetter is called at execution time to get the current
 * provider config (API key, model, etc.) from the settings store.
 *
 * SubAgent events are emitted to the global subAgentEvents bus
 * so the UI layer can track inner progress.
 */
export function createTaskTool(
  providerGetter: () => ProviderConfig
): ToolHandler {
  const agents = subAgentRegistry.getAll()
  const subTypeEnum = agents.map((a) => a.name)

  return {
    definition: {
      name: TASK_TOOL_NAME,
      description: buildTaskDescription(agents),
      inputSchema: {
        type: 'object',
        properties: {
          subType: {
            type: 'string',
            enum: subTypeEnum,
            description: 'The name of the sub-agent to invoke',
          },
          description: {
            type: 'string',
            description: 'A short (3-5 word) description of the task',
          },
          prompt: {
            type: 'string',
            description: 'The detailed task for the sub-agent to perform',
          },
        },
        required: ['subType', 'description', 'prompt'],
      },
    },
    execute: async (input, ctx) => {
      const subType = String(input.subType ?? '')
      const def = subAgentRegistry.get(subType)
      if (!def) {
        return JSON.stringify({ error: `Unknown subType "${subType}". Available: ${subTypeEnum.join(', ')}` })
      }

      // Acquire concurrency slot (blocks if 2 SubAgents are already running)
      await subAgentLimiter.acquire(ctx.signal)

      try {
      // Collect inner tool calls for metadata embedding
      const collectedToolCalls = new Map<string, ToolCallState>()
      let startedAt = Date.now()

      const onEvent = (event: SubAgentEvent): void => {
        subAgentEvents.emit(event)
        if (event.type === 'sub_agent_start') {
          startedAt = Date.now()
        }
        if (event.type === 'sub_agent_tool_call') {
          collectedToolCalls.set(event.toolCall.id, event.toolCall)
        }
      }

      const result = await runSubAgent({
        definition: def,
        parentProvider: providerGetter(),
        toolContext: ctx,
        input,
        toolUseId: ctx.currentToolUseId ?? '',
        onEvent,
        onApprovalNeeded: async (tc: ToolCallState) => {
          const autoApprove = useSettingsStore.getState().autoApprove
          if (autoApprove) return true
          const approved = useAgentStore.getState().approvedToolNames
          if (approved.includes(tc.name)) return true
          // Show in PermissionDialog
          useAgentStore.getState().addToolCall(tc)
          const result = await useAgentStore.getState().requestApproval(tc.id)
          if (result) useAgentStore.getState().addApprovedTool(tc.name)
          return result
        },
      })

      // Build metadata for historical rendering (truncate large outputs to prevent bloat)
      const MAX_OUTPUT = 4000
      const MAX_INPUT_VALUE = 2000
      const truncStr = (s: string | undefined, max: number): string | undefined => {
        if (!s || s.length <= max) return s
        return s.slice(0, max) + `\n... [truncated, ${s.length} chars total]`
      }
      const truncInput = (inp: Record<string, unknown>): Record<string, unknown> => {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(inp)) {
          out[k] = typeof v === 'string' && v.length > MAX_INPUT_VALUE
            ? v.slice(0, MAX_INPUT_VALUE) + `... [${v.length} chars]`
            : v
        }
        return out
      }
      const meta: SubAgentMeta = {
        iterations: result.iterations,
        elapsed: Date.now() - startedAt,
        usage: result.usage,
        toolCalls: Array.from(collectedToolCalls.values()).map((tc) => ({
          id: tc.id,
          name: tc.name,
          input: truncInput(tc.input),
          status: tc.status,
          output: truncStr(typeof tc.output === 'string' ? tc.output : tc.output ? JSON.stringify(tc.output) : undefined, MAX_OUTPUT),
          error: tc.error,
          startedAt: tc.startedAt,
          completedAt: tc.completedAt,
        })),
      }
      const metaStr = `${META_PREFIX}${JSON.stringify(meta)}${META_SUFFIX}`

      if (!result.success) {
        return metaStr + JSON.stringify({
          error: result.error ?? 'SubAgent failed',
          toolCalls: result.toolCallCount,
          iterations: result.iterations,
        })
      }

      return metaStr + result.output
      } finally {
        subAgentLimiter.release()
      }
    },
    requiresApproval: () => false,
  }
}
