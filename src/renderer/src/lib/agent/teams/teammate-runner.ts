import { nanoid } from 'nanoid'
import { runAgentLoop } from '../agent-loop'
import { toolRegistry } from '../tool-registry'
import { teamEvents } from './events'
import { useTeamStore } from '../../../stores/team-store'
import { useSettingsStore } from '../../../stores/settings-store'
import { ipcClient } from '../../ipc/ipc-client'
import { MessageQueue } from '../types'
import type { AgentLoopConfig, ToolCallState } from '../types'
import type { UnifiedMessage, ProviderConfig } from '../../api/types'
import type { TeamMessage, TeamTask } from './types'

// --- AbortController registry for individual teammates ---
const teammateAbortControllers = new Map<string, AbortController>()

// --- Graceful shutdown registry ---
// When a shutdown_request is received, the teammate finishes its current
// iteration and then stops — instead of hard aborting mid-tool-call.
const teammateShutdownRequested = new Set<string>()

/**
 * Request graceful shutdown: teammate finishes current iteration then stops.
 */
export function requestTeammateShutdown(memberId: string): void {
  teammateShutdownRequested.add(memberId)
}

/**
 * Abort a running teammate by member ID (hard stop).
 * Returns true if the teammate was found and aborted.
 */
export function abortTeammate(memberId: string): boolean {
  const ac = teammateAbortControllers.get(memberId)
  if (ac) {
    ac.abort()
    teammateAbortControllers.delete(memberId)
    teammateShutdownRequested.delete(memberId)
    return true
  }
  return false
}

/** Abort all running teammates (e.g. on TeamDelete). */
export function abortAllTeammates(): void {
  for (const [id, ac] of teammateAbortControllers) {
    ac.abort()
    teammateAbortControllers.delete(id)
  }
  teammateShutdownRequested.clear()
}

/** Check if a teammate is still running. */
export function isTeammateRunning(memberId: string): boolean {
  return teammateAbortControllers.has(memberId)
}

interface RunTeammateOptions {
  memberId: string
  memberName: string
  prompt: string
  taskId: string | null
  model: string | null
  workingFolder?: string
}

/**
 * Start an independent agent loop for a teammate.
 * Runs in background (fire-and-forget). Updates team-store via teamEvents.
 *
 * After completing its assigned task, the teammate will automatically claim
 * the next unassigned, unblocked pending task and continue working — matching
 * the Claude Code agent-teams behavior of self-claiming tasks.
 *
 * On completion (or error), the teammate automatically sends a summary
 * message to the lead so the lead's context includes the result without
 * needing to call TeamAwait.
 */
export async function runTeammate(options: RunTeammateOptions): Promise<void> {
  const { memberId, memberName, model, workingFolder } = options
  let { prompt, taskId } = options

  const abortController = new AbortController()
  teammateAbortControllers.set(memberId, abortController)

  // Exclude team management tools from teammate (only lead should manage team)
  const LEAD_ONLY_TOOLS = new Set(['TeamCreate', 'TeamDelete', 'SpawnTeammate', 'TeamAwait'])
  const toolDefs = toolRegistry.getDefinitions().filter((t) => !LEAD_ONLY_TOOLS.has(t.name))

  // Message queue: receives messages from lead/other teammates and injects
  // them into the agent loop at iteration boundaries (between turns).
  const messageQueue = new MessageQueue()

  // Listen for team messages targeting this teammate
  const unsubMessages = teamEvents.on((event) => {
    if (event.type !== 'team_message') return
    const msg = event.message
    const isForMe = msg.to === memberName || msg.to === 'all'
    if (!isForMe) return
    // Don't inject our own messages
    if (msg.from === memberName) return

    if (msg.type === 'shutdown_request') {
      teammateShutdownRequested.add(memberId)
    } else {
      // Inject as a user message so the LLM sees it on the next turn
      messageQueue.push({
        id: nanoid(),
        role: 'user',
        content: `[Team message from ${msg.from}]: ${msg.content}`,
        createdAt: msg.timestamp,
      })
    }
  })

  let totalIterations = 0
  let totalToolCalls = 0
  let tasksCompleted = 0
  let lastStreamingText = ''
  let endReason: 'completed' | 'aborted' | 'error' | 'shutdown' = 'completed'

  try {
    // === Task loop: work on current task, then auto-claim next ===
    let continueWorking = true
    while (continueWorking) {
      if (abortController.signal.aborted) break
      if (teammateShutdownRequested.has(memberId)) {
        endReason = 'shutdown'
        break
      }

      const result = await runSingleTaskLoop({
        memberId,
        memberName,
        prompt,
        taskId,
        model,
        workingFolder,
        abortController,
        toolDefs,
        messageQueue,
      })

      totalIterations += result.iterations
      totalToolCalls += result.toolCalls
      lastStreamingText = result.lastStreamingText
      if (result.taskCompleted) tasksCompleted++
      if (result.reason === 'aborted') {
        endReason = 'aborted'
        break
      }
      if (result.reason === 'shutdown') {
        endReason = 'shutdown'
        break
      }

      // --- P1: Auto-claim next unassigned, unblocked task ---
      if (abortController.signal.aborted || teammateShutdownRequested.has(memberId)) break

      const nextTask = findNextClaimableTask()
      if (!nextTask) {
        continueWorking = false
      } else {
        // Claim the task
        taskId = nextTask.id
        prompt = `Work on the following task:\n**Subject:** ${nextTask.subject}\n**Description:** ${nextTask.description}`

        teamEvents.emit({
          type: 'team_task_update',
          taskId: nextTask.id,
          patch: { status: 'in_progress', owner: memberName },
        })
        teamEvents.emit({
          type: 'team_member_update',
          memberId,
          patch: { currentTaskId: nextTask.id, status: 'working', streamingText: '', toolCalls: [] },
        })
      }
    }

    // Mark member as stopped
    teamEvents.emit({
      type: 'team_member_update',
      memberId,
      patch: { status: 'stopped', completedAt: Date.now() },
    })
  } catch (err) {
    endReason = 'error'
    if (!abortController.signal.aborted) {
      console.error(`[Teammate ${memberName}] Error:`, err)
    }
    teamEvents.emit({
      type: 'team_member_update',
      memberId,
      patch: { status: 'stopped', completedAt: Date.now() },
    })
  } finally {
    teammateAbortControllers.delete(memberId)
    teammateShutdownRequested.delete(memberId)
    unsubMessages()

    // --- P0: Auto-notify lead with completion summary ---
    emitCompletionMessage(memberName, endReason, {
      totalIterations,
      totalToolCalls,
      tasksCompleted,
      lastStreamingText,
    })
  }
}

// ── Single task execution ──────────────────────────────────────────

interface SingleTaskResult {
  iterations: number
  toolCalls: number
  lastStreamingText: string
  taskCompleted: boolean
  reason: 'completed' | 'max_iterations' | 'aborted' | 'shutdown' | 'error'
}

async function runSingleTaskLoop(opts: {
  memberId: string
  memberName: string
  prompt: string
  taskId: string | null
  model: string | null
  workingFolder?: string
  abortController: AbortController
  toolDefs: ReturnType<typeof toolRegistry.getDefinitions>
  messageQueue?: MessageQueue
}): Promise<SingleTaskResult> {
  const { memberId, memberName, prompt, taskId, model, workingFolder, abortController, toolDefs, messageQueue } = opts

  // Build provider config
  const settings = useSettingsStore.getState()
  const providerConfig: ProviderConfig = {
    type: settings.provider,
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl || undefined,
    model: model && model !== 'default' ? model : settings.model,
    maxTokens: settings.maxTokens,
    temperature: settings.temperature,
  }

  const team = useTeamStore.getState().activeTeam
  const taskInfo = taskId && team ? team.tasks.find((t) => t.id === taskId) : null

  const systemPrompt = buildTeammateSystemPrompt({
    memberName,
    teamName: team?.name ?? 'team',
    prompt,
    task: taskInfo ? { id: taskInfo.id, subject: taskInfo.subject, description: taskInfo.description } : null,
    workingFolder,
  })
  providerConfig.systemPrompt = systemPrompt

  const loopConfig: AgentLoopConfig = {
    maxIterations: 15,
    provider: providerConfig,
    tools: toolDefs,
    systemPrompt,
    workingFolder,
    signal: abortController.signal,
    messageQueue,
  }

  const userMsg: UnifiedMessage = {
    id: nanoid(),
    role: 'user',
    content: prompt,
    createdAt: Date.now(),
  }

  // Mark member as working
  teamEvents.emit({
    type: 'team_member_update',
    memberId,
    patch: { status: 'working', iteration: 0 },
  })

  const collectedToolCalls: ToolCallState[] = []
  let iteration = 0
  let streamingText = ''
  let reason: SingleTaskResult['reason'] = 'completed'
  let taskCompleted = false

  try {
    const loop = runAgentLoop(
      [userMsg],
      loopConfig,
      { workingFolder, signal: abortController.signal, ipc: ipcClient },
      async (tc) => {
        if (READ_ONLY_TOOLS.has(tc.name)) return true
        const autoApprove = useSettingsStore.getState().autoApprove
        if (autoApprove) return true
        return false
      }
    )

    for await (const event of loop) {
      if (abortController.signal.aborted) {
        reason = 'aborted'
        break
      }

      switch (event.type) {
        case 'iteration_start':
          // Check graceful shutdown between iterations
          if (teammateShutdownRequested.has(memberId)) {
            reason = 'shutdown'
            break
          }
          iteration = event.iteration
          streamingText = ''
          teamEvents.emit({
            type: 'team_member_update',
            memberId,
            patch: { iteration, status: 'working', streamingText: '' },
          })
          break

        case 'text_delta':
          streamingText += event.text
          teamEvents.emit({
            type: 'team_member_update',
            memberId,
            patch: { streamingText },
          })
          break

        case 'tool_call_start':
        case 'tool_call_result':
          {
            const idx = collectedToolCalls.findIndex((t) => t.id === event.toolCall.id)
            if (idx >= 0) {
              collectedToolCalls[idx] = event.toolCall
            } else {
              collectedToolCalls.push(event.toolCall)
            }
            teamEvents.emit({
              type: 'team_member_update',
              memberId,
              patch: { toolCalls: [...collectedToolCalls] },
            })
          }
          break

        case 'loop_end':
          reason = event.reason as SingleTaskResult['reason']
          if ((event.reason === 'completed' || event.reason === 'max_iterations') && taskId) {
            teamEvents.emit({
              type: 'team_task_update',
              taskId,
              patch: { status: 'completed' },
            })
            taskCompleted = true
          }
          break
      }

      // Break outer for-await if shutdown was requested during iteration_start
      if (reason === 'shutdown') break
    }
  } catch {
    reason = 'error'
  }

  return {
    iterations: iteration,
    toolCalls: collectedToolCalls.length,
    lastStreamingText: streamingText,
    taskCompleted,
    reason,
  }
}

// ── Auto-claim: find next unassigned, unblocked pending task ──────

function findNextClaimableTask(): TeamTask | null {
  const team = useTeamStore.getState().activeTeam
  if (!team) return null

  // Get completed task IDs for dependency checking
  const completedTaskIds = new Set(
    team.tasks.filter((t) => t.status === 'completed').map((t) => t.id)
  )

  for (const task of team.tasks) {
    if (task.status !== 'pending') continue
    if (task.owner) continue // already assigned

    // Check dependencies are all completed
    const allDepsCompleted = task.dependsOn.every((depId) => completedTaskIds.has(depId))
    if (!allDepsCompleted) continue

    return task
  }

  return null
}

// ── Auto-notify: send completion summary to lead ─────────────────

function emitCompletionMessage(
  memberName: string,
  endReason: string,
  stats: { totalIterations: number; totalToolCalls: number; tasksCompleted: number; lastStreamingText: string }
): void {
  const team = useTeamStore.getState().activeTeam
  if (!team) return // team already deleted

  const summary = [
    `**${memberName}** finished (${endReason}).`,
    `Iterations: ${stats.totalIterations}, Tool calls: ${stats.totalToolCalls}, Tasks completed: ${stats.tasksCompleted}.`,
  ].join(' ')

  const content = [
    summary,
    stats.lastStreamingText
      ? `\nLast output:\n${stats.lastStreamingText.slice(-300)}`
      : '',
  ].join('')

  const msg: TeamMessage = {
    id: nanoid(8),
    from: memberName,
    to: 'lead',
    type: 'message',
    content,
    summary: `${memberName} finished (${endReason}): ${stats.tasksCompleted} tasks, ${stats.totalToolCalls} tool calls`,
    timestamp: Date.now(),
  }

  teamEvents.emit({ type: 'team_message', message: msg })
}

// --- Helpers ---

const READ_ONLY_TOOLS = new Set(['Read', 'LS', 'Glob', 'Grep', 'TodoRead', 'TaskList', 'TeamStatus'])

function buildTeammateSystemPrompt(options: {
  memberName: string
  teamName: string
  prompt: string
  task: { id: string; subject: string; description: string } | null
  workingFolder?: string
}): string {
  const { memberName, teamName, prompt, task, workingFolder } = options

  const parts: string[] = []

  parts.push(
    `You are "${memberName}", a teammate agent in the "${teamName}" team.`,
    `You are part of a multi-agent team working in parallel on a shared codebase.`,
    `You should focus exclusively on your assigned work and avoid modifying files outside your scope.`
  )

  if (task) {
    parts.push(
      `\n## Your Task`,
      `**ID:** ${task.id}`,
      `**Subject:** ${task.subject}`,
      `**Description:** ${task.description}`
    )
  }

  parts.push(`\n## Instructions\n${prompt}`)

  if (workingFolder) {
    parts.push(`\n## Working Folder\n\`${workingFolder}\``)
    parts.push(`All relative paths should be resolved against this folder.`)
  }

  parts.push(
    `\n## Coordination Rules`,
    `- Only modify files related to your assigned task.`,
    `- Use TaskUpdate to mark your task as completed when done.`,
    `- Use TeamSendMessage to communicate with the lead or other teammates if needed.`,
    `- After completing your task, you will automatically be assigned the next available pending task if one exists.`,
    `- If you receive a shutdown request, finish your current work promptly and stop.`,
    `- Be concise and efficient — you have limited iterations.`
  )

  return parts.join('\n')
}
