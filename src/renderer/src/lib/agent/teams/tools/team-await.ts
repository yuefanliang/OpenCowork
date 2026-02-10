import type { ToolHandler } from '../../../tools/tool-types'
import { useTeamStore } from '../../../../stores/team-store'
import { teamEvents } from '../events'

/**
 * TeamAwait — blocks until all (or specified) teammates have finished,
 * then returns a full summary of the team's state including member results,
 * task statuses, and messages exchanged.
 */
export const teamAwaitTool: ToolHandler = {
  definition: {
    name: 'TeamAwait',
    description:
      'Wait for all teammates to finish their work, then return a comprehensive summary of the team state including each member\'s final status, all task statuses, and messages. Call this after spawning teammates to collect their results.',
    inputSchema: {
      type: 'object',
      properties: {
        timeout_seconds: {
          type: 'number',
          description: 'Maximum seconds to wait. Defaults to 300 (5 minutes).',
        },
        member_ids: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional list of specific member IDs to wait for. If omitted, waits for ALL members to finish.',
        },
      },
      required: [],
    },
  },

  execute: async (input, ctx) => {
    const team = useTeamStore.getState().activeTeam
    if (!team) {
      return JSON.stringify({ error: 'No active team' })
    }

    const timeoutMs = (Number(input.timeout_seconds) || 300) * 1000
    const targetIds: string[] | null = Array.isArray(input.member_ids)
      ? input.member_ids.map(String)
      : null

    // Check if already done
    if (allDone(targetIds)) {
      return buildSummary()
    }

    // Wait via event listener + polling fallback
    return new Promise<string>((resolve) => {
      let settled = false
      const settle = (result: string): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        unsub()
        resolve(result)
      }

      // Timeout
      const timer = setTimeout(() => {
        settle(buildSummary('timeout'))
      }, timeoutMs)

      // Listen for member updates
      const unsub = teamEvents.on((event) => {
        if (
          event.type === 'team_member_update' ||
          event.type === 'team_end'
        ) {
          // Small delay to let store update first
          setTimeout(() => {
            if (allDone(targetIds)) {
              settle(buildSummary())
            }
          }, 50)
        }
      })

      // Abort signal
      if (ctx.signal) {
        ctx.signal.addEventListener('abort', () => {
          settle(buildSummary('aborted'))
        }, { once: true })
      }
    })
  },

  requiresApproval: () => false,
}

/** Check if all targeted members are done (status !== 'working') */
function allDone(targetIds: string[] | null): boolean {
  const team = useTeamStore.getState().activeTeam
  if (!team) return true
  const members = targetIds
    ? team.members.filter((m) => targetIds.includes(m.id))
    : team.members
  if (members.length === 0) return true
  return members.every((m) => m.status !== 'working')
}

/** Build a comprehensive result summary from team-store */
function buildSummary(reason?: 'timeout' | 'aborted'): string {
  const team = useTeamStore.getState().activeTeam
  if (!team) {
    return JSON.stringify({ error: 'Team was deleted while waiting' })
  }

  const completedTasks = team.tasks.filter((t) => t.status === 'completed').length
  const totalTasks = team.tasks.length

  return JSON.stringify({
    ...(reason ? { warning: `Wait ended due to ${reason}` } : {}),
    team_name: team.name,
    summary: `${completedTasks}/${totalTasks} tasks completed, ${team.members.length} members`,
    members: team.members.map((m) => ({
      id: m.id,
      name: m.name,
      status: m.status,
      task_id: m.currentTaskId,
      iterations: m.iteration,
      tool_calls_count: m.toolCalls.length,
      last_output: m.streamingText
        ? m.streamingText.slice(-500)
        : undefined,
    })),
    tasks: team.tasks.map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      owner: t.owner,
    })),
    messages: team.messages.slice(-20).map((msg) => ({
      from: msg.from,
      to: msg.to,
      content: msg.content,
      type: msg.type,
    })),
  })
}
