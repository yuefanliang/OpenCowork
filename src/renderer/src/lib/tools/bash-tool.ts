import { toolRegistry } from '../agent/tool-registry'
import { IPC } from '../ipc/channels'
import type { ToolHandler } from './tool-types'

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
          description: 'Timeout in milliseconds (max 600000, default 120000)',
        },
        description: { type: 'string', description: '5-10 word description of the command' },
      },
      required: ['command'],
    },
  },
  execute: async (input, ctx) => {
    const result = await ctx.ipc.invoke(IPC.SHELL_EXEC, {
      command: input.command,
      timeout: input.timeout ?? 120000,
      cwd: ctx.workingFolder,
    })
    return JSON.stringify(result)
  },
  requiresApproval: () => true, // Shell commands always require approval
}

export function registerBashTools(): void {
  toolRegistry.register(bashHandler)
}
