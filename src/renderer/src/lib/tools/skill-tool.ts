import type { ToolHandler } from './tool-types'
import { toolRegistry } from '../agent/tool-registry'

const skillHandler: ToolHandler = {
  definition: {
    name: 'Skill',
    description:
      'Load a skill by name to get detailed instructions or knowledge for a specific task. Use this when a task matches a skill\'s description. Returns the full content of the skill\'s SKILL.md file as context.',
    inputSchema: {
      type: 'object',
      properties: {
        SkillName: {
          type: 'string',
          description: 'The name of the skill to load. Must match one of the available skills listed in the system prompt.',
        },
      },
      required: ['SkillName'],
    },
  },
  execute: async (input, ctx) => {
    const skillName = input.SkillName as string
    if (!skillName) {
      return JSON.stringify({ error: 'SkillName is required' })
    }
    try {
      const result = await ctx.ipc.invoke('skills:load', { name: skillName }) as
        | { content: string; workingDirectory: string }
        | { error: string }
      if ('error' in result) {
        return JSON.stringify({ error: result.error })
      }
      return `<skill_context>\n<working_directory>${result.workingDirectory}</working_directory>\n<instruction>CRITICAL: When executing any script mentioned in this skill, you MUST prepend the working_directory to form an absolute path. For example, if the skill says "python scripts/foo.py", you must run "python ${result.workingDirectory}/scripts/foo.py". NEVER run scripts using bare relative paths like "python scripts/foo.py" — they will fail because your cwd is not the skill directory.</instruction>\n</skill_context>\n\n${result.content}`
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) })
    }
  },
  requiresApproval: () => false,
}

export function registerSkillTools(): void {
  toolRegistry.register(skillHandler)
}
