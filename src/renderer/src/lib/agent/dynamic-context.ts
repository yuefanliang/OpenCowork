import { useTaskStore } from '../../stores/task-store'
import { useTeamStore } from '../../stores/team-store'
import { useUIStore } from '../../stores/ui-store'
import { useChatStore } from '../../stores/chat-store'
import { useSettingsStore } from '../../stores/settings-store'
import { usePlanStore } from '../../stores/plan-store'

/**
 * Build dynamic context for the first user message in a session.
 * Includes current task list status and selected files (if any).
 * 
 * @param options - Configuration options
 * @returns A <system-remind> block with context, or empty string if no context
 */
export function buildDynamicContext(options: {
  sessionId: string
}): string {
  const { sessionId } = options
  const language = useSettingsStore.getState().language

  const contextParts: string[] = []
  let hasExistingTasks = false

  // ── Task List Status ──
  const hasActiveTeam = !!useTeamStore.getState().activeTeam
  
  if (hasActiveTeam) {
    // Team mode: get team tasks
    const team = useTeamStore.getState().activeTeam!
    const tasks = team.tasks
    
    if (tasks.length > 0) {
      hasExistingTasks = true
      const pending = tasks.filter(t => t.status === 'pending').length
      const inProgress = tasks.filter(t => t.status === 'in_progress').length
      const completed = tasks.filter(t => t.status === 'completed').length
      
      const taskSummary = language === 'zh'
        ? `- 任务列表: ${tasks.length} 个任务 (${pending} 待处理, ${inProgress} 进行中, ${completed} 已完成)`
        : `- Task List: ${tasks.length} tasks (${pending} pending, ${inProgress} in_progress, ${completed} completed)`
      
      contextParts.push(taskSummary)
      
      // Add guidance based on task status
      if (inProgress > 0 || pending > 0) {
        const guidance = language === 'zh'
          ? '  提示: 继续执行现有任务，使用 TaskUpdate 更新状态'
          : '  Reminder: Continue with existing tasks, use TaskUpdate to update status'
        contextParts.push(guidance)
      }
    }
  } else {
    // Standalone mode: get session tasks
    const tasks = useTaskStore.getState().getTasks()
    
    if (tasks.length > 0) {
      hasExistingTasks = true
      const pending = tasks.filter(t => t.status === 'pending').length
      const inProgress = tasks.filter(t => t.status === 'in_progress').length
      const completed = tasks.filter(t => t.status === 'completed').length
      
      const taskSummary = language === 'zh'
        ? `- 任务列表: ${tasks.length} 个任务 (${pending} 待处理, ${inProgress} 进行中, ${completed} 已完成)`
        : `- Task List: ${tasks.length} tasks (${pending} pending, ${inProgress} in_progress, ${completed} completed)`
      
      contextParts.push(taskSummary)
      
      // Add guidance based on task status
      if (inProgress > 0 || pending > 0) {
        const guidance = language === 'zh'
          ? '  提示: 继续执行现有任务，使用 TaskUpdate 更新状态'
          : '  Reminder: Continue with existing tasks, use TaskUpdate to update status'
        contextParts.push(guidance)
      }
    }
  }

  // ── Plan Status ──
  const plan = usePlanStore.getState().getPlanBySession(sessionId)
  if (plan) {
    const planInfo = language === 'zh'
      ? `- 计划: "${plan.title}" (状态: ${plan.status})`
      : `- Plan: "${plan.title}" (status: ${plan.status})`
    contextParts.push(planInfo)

    if (plan.status === 'approved' || plan.status === 'implementing') {
      const planGuidance = language === 'zh'
        ? `  提示: 存在已批准的计划，请按照计划步骤执行实现。计划文件: ${plan.filePath ?? '.plan/' + plan.id + '.md'}`
        : `  Reminder: An approved plan exists. Follow the plan steps for implementation. Plan file: ${plan.filePath ?? '.plan/' + plan.id + '.md'}`
      contextParts.push(planGuidance)
    }

    if (plan.filePath) {
      const fileInfo = language === 'zh'
        ? `  计划文件: ${plan.filePath}`
        : `  Plan file: ${plan.filePath}`
      contextParts.push(fileInfo)
    }
  }

  // ── Selected Files ──
  const selectedFiles = useUIStore.getState().selectedFiles ?? []
  const session = useChatStore.getState().sessions.find(s => s.id === sessionId)
  const workingFolder = session?.workingFolder

  if (selectedFiles.length > 0) {
    const fileHeader = language === 'zh'
      ? `- 选中的文件: ${selectedFiles.length} 个文件`
      : `- Selected Files: ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}`
    
    contextParts.push(fileHeader)
    
    // Convert to relative paths if possible
    for (const filePath of selectedFiles) {
      let displayPath = filePath
      if (workingFolder && filePath.startsWith(workingFolder)) {
        displayPath = filePath.slice(workingFolder.length).replace(/^[\\\/]/, '')
      }
      contextParts.push(`  - ${displayPath}`)
    }
  }

  // ── Build final context ──
  if (contextParts.length === 0) {
    return '' // No context to inject
  }

  // Add header and guidance
  const header = language === 'zh' ? '当前上下文' : 'Current Context'
  
  // Add task creation reminder only if no existing tasks
  let footer = ''
  if (!hasExistingTasks) {
    footer = language === 'zh'
      ? '\n注意: 如果用户请求是复杂任务（3+ 步骤或多文件），请先使用 TaskCreate 创建任务列表。'
      : '\nNote: If the user request is complex (3+ steps or multiple files), create tasks using TaskCreate first.'
  }

  const contextContent = contextParts.join('\n')
  return `<system-remind>\n${header}:\n${contextContent}${footer}\n</system-remind>`
}
