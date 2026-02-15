import { toolRegistry } from '../agent/tool-registry'
import { usePlanStore } from '../../stores/plan-store'
import { useUIStore } from '../../stores/ui-store'
import { useChatStore } from '../../stores/chat-store'
import type { ToolHandler } from './tool-types'

// ── Helpers ──

function getWorkingFolder(): string | undefined {
  const session = useChatStore.getState().getActiveSession()
  return session?.workingFolder
}

function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')    // non-ascii-alnum → dash
    .replace(/^-+|-+$/g, '')         // trim dashes
    .slice(0, 60)                    // cap length
    || 'plan'
}

function getPlanFilePath(workingFolder: string, title: string): string {
  const slug = titleToSlug(title)
  return workingFolder.replace(/[\\/]$/, '') + `/.plan/${slug}.md`
}

// ── EnterPlanMode ──

const enterPlanModeHandler: ToolHandler = {
  definition: {
    name: 'EnterPlanMode',
    description:
      'Enter Plan Mode to explore the codebase and create a detailed implementation plan before writing any code. ' +
      'Use this proactively when starting non-trivial tasks that require architectural decisions, multi-file changes, ' +
      'or when multiple valid approaches exist. In plan mode, only read/search and the Write tool (for writing the plan file) are allowed — ' +
      'no Edit/Shell commands.',
    inputSchema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Brief reason in English for entering plan mode. This is used as the plan file name, so always use English. (e.g. "add-user-authentication", "refactor-api-layer")',
        },
      },
    },
  },
  execute: async (input) => {
    const uiStore = useUIStore.getState()

    const workingFolder = getWorkingFolder()
    if (!workingFolder) {
      return JSON.stringify({ error: 'No working folder set. Please select a working folder first.' })
    }

    const session = useChatStore.getState().getActiveSession()
    if (!session) {
      return JSON.stringify({ error: 'No active session.' })
    }

    // Check if session already has a plan
    const existingPlan = usePlanStore.getState().getPlanBySession(session.id)
    if (existingPlan && existingPlan.status === 'drafting') {
      if (!uiStore.planMode) uiStore.enterPlanMode()
      usePlanStore.getState().setActivePlan(existingPlan.id)
      const existingFile = existingPlan.filePath || getPlanFilePath(workingFolder, existingPlan.title)
      return JSON.stringify({
        status: 'resumed',
        plan_id: existingPlan.id,
        plan_file: existingFile,
        message: `Resumed existing draft plan. Use Write tool to update the plan file at: ${existingFile}`,
      })
    }

    // Create new plan record
    const reason = input.reason ? String(input.reason) : 'Implementation planning'
    const planFilePath = getPlanFilePath(workingFolder, reason)
    const plan = usePlanStore.getState().createPlan(session.id, reason)
    usePlanStore.getState().updatePlan(plan.id, { filePath: planFilePath })

    if (!uiStore.planMode) uiStore.enterPlanMode()
    uiStore.setRightPanelTab('plan')
    uiStore.setRightPanelOpen(true)

    return JSON.stringify({
      status: 'entered',
      plan_id: plan.id,
      plan_file: planFilePath,
      message: `Plan mode activated. Explore the codebase with read-only tools, then use the Write tool to write your plan to: ${planFilePath}. Call ExitPlanMode when complete.`,
    })
  },
  requiresApproval: () => false,
}

// ── ExitPlanMode ──

const exitPlanModeHandler: ToolHandler = {
  definition: {
    name: 'ExitPlanMode',
    description:
      'Exit Plan Mode after completing the plan. This signals that the plan is finalized and ready for user review. ' +
      'The user can then click "Implement" in the Plan panel or reply to start implementation. ' +
      'IMPORTANT: Ensure you have written the plan file using Write before calling this tool. ' +
      'After calling this tool, you MUST STOP and wait for the user to review the plan — do NOT continue with any further actions.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  execute: async () => {
    const uiStore = useUIStore.getState()

    if (!uiStore.planMode) {
      return JSON.stringify({ status: 'not_in_plan_mode', message: 'You are not currently in plan mode.' })
    }

    const activePlan = usePlanStore.getState().getActivePlan()
    if (!activePlan) {
      uiStore.exitPlanMode()
      return JSON.stringify({ status: 'exited', message: 'Plan mode exited (no active plan found).' })
    }

    // Mark plan as approved
    usePlanStore.getState().approvePlan(activePlan.id)

    // Exit plan mode UI
    uiStore.exitPlanMode()

    return JSON.stringify({
      status: 'approved',
      plan_id: activePlan.id,
      title: activePlan.title,
      message: 'Plan finalized and approved. STOP HERE — do not continue. Wait for the user to review the plan and decide to proceed. The user can click "Implement" in the Plan panel or reply to you.',
    })
  },
  requiresApproval: () => false,
}

// ── Registration ──

export function registerPlanTools(): void {
  toolRegistry.register(enterPlanModeHandler)
  toolRegistry.register(exitPlanModeHandler)
}

// ── Plan Mode Tool Filter ──

/** Tool names allowed in plan mode (read-only + planning tools) */
export const PLAN_MODE_ALLOWED_TOOLS = new Set([
  // Read-only filesystem
  'Read',
  'LS',
  'Glob',
  'Grep',
  // Write (for creating the plan file)
  'Write',
  // Planning tools
  'EnterPlanMode',
  'ExitPlanMode',
  'AskUserQuestion',
  // Task tracking
  'TaskCreate',
  'TaskGet',
  'TaskUpdate',
  'TaskList',
  // SubAgent (read-only explorers)
  'Task',
  // Preview (read-only)
  'Preview',
])
