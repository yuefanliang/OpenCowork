import { toolRegistry } from '../agent/tool-registry'
import { IPC } from '../ipc/channels'
import type { ToolHandler } from './tool-types'
import { useAgentStore } from '@renderer/stores/agent-store'

let execCounter = 0
const DEFAULT_BASH_TIMEOUT_MS = 600_000

const bashHandler: ToolHandler = {
  definition: {
    name: 'Bash',
    description: 'Execute a shell command',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The command to execute' },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (max 3600000, default 600000)',
        },
        description: { type: 'string', description: '5-10 word description of the command' },
      },
      required: ['command'],
    },
  },
  execute: async (input, ctx) => {
    const execId = `exec-${Date.now()}-${++execCounter}`
    const toolUseId = ctx.currentToolUseId

    // Listen for streaming output chunks from main process
    let accumulated = ''
    const cleanup = ctx.ipc.on('shell:output', (...args: unknown[]) => {
      const data = args[0] as { execId: string; chunk: string }
      if (data.execId !== execId) return
      accumulated += data.chunk
      if (toolUseId) {
        useAgentStore.getState().updateToolCall(toolUseId, {
          output: accumulated,
        })
      }
    })

    const abortHandler = (): void => {
      ctx.ipc.send(IPC.SHELL_ABORT, { execId })
    }
    ctx.signal.addEventListener('abort', abortHandler, { once: true })

    try {
      const result = await ctx.ipc.invoke(IPC.SHELL_EXEC, {
        command: input.command,
        timeout: input.timeout ?? DEFAULT_BASH_TIMEOUT_MS,
        cwd: ctx.workingFolder,
        execId,
      })
      return JSON.stringify(result)
    } finally {
      ctx.signal.removeEventListener('abort', abortHandler)
      cleanup()
    }
  },
  requiresApproval: () => true, // Shell commands always require approval
}

export function registerBashTools(): void {
  toolRegistry.register(bashHandler)
}
