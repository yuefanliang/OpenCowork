import { ClipboardList, FileText, Loader2, Play, PenLine } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Separator } from '@renderer/components/ui/separator'
import { usePlanStore, type Plan, type PlanStatus } from '@renderer/stores/plan-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { useChatStore } from '@renderer/stores/chat-store'
import { useAgentStore } from '@renderer/stores/agent-store'
import { useFileWatcher } from '@renderer/hooks/use-file-watcher'
import { sendImplementPlan } from '@renderer/hooks/use-chat-actions'
import { cn } from '@renderer/lib/utils'

function StatusBadge({ status }: { status: PlanStatus }): React.JSX.Element {
  const colorMap: Record<PlanStatus, string> = {
    drafting: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    approved: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
    implementing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    completed: 'bg-muted text-muted-foreground border-border',
  }
  const labelMap: Record<PlanStatus, string> = {
    drafting: 'Drafting',
    approved: 'Approved',
    implementing: 'Implementing',
    completed: 'Completed',
  }
  return (
    <Badge variant="outline" className={cn('text-[10px] font-medium', colorMap[status])}>
      {labelMap[status]}
    </Badge>
  )
}

function PlanContent({ plan }: { plan: Plan }): React.JSX.Element {
  const { t } = useTranslation('cowork')
  const planMode = useUIStore((s) => s.planMode)
  const enterPlanMode = useUIStore((s) => s.enterPlanMode)
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const isRunning = useAgentStore((s) => activeSessionId ? s.runningSessions[activeSessionId] === 'running' : false)
  const { content: fileContent, loading } = useFileWatcher(plan.filePath || null)

  const markdownComponents: Components = {
    p: ({ children, ...props }) => (
      <p className="my-1 first:mt-0 last:mb-0 leading-snug" {...props}>
        {children}
      </p>
    ),
    ul: ({ children, ...props }) => (
      <ul className="my-1 last:mb-0 list-disc pl-4 space-y-0.5" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol className="my-1 last:mb-0 list-decimal pl-4 space-y-0.5" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => (
      <li className="leading-snug [&>p]:m-0" {...props}>
        {children}
      </li>
    ),
  }

  const handleImplement = (): void => {
    sendImplementPlan(plan.id)
  }

  const handleEditPlan = (): void => {
    usePlanStore.getState().setActivePlan(plan.id)
    usePlanStore.getState().updatePlan(plan.id, { status: 'drafting' })
    enterPlanMode()
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FileText className="size-4 shrink-0 text-violet-500" />
            <h3 className="text-sm font-medium truncate">{plan.title}</h3>
          </div>
          {plan.filePath && (
            <p className="mt-0.5 text-[10px] text-muted-foreground/60 truncate">{plan.filePath}</p>
          )}
        </div>
        <StatusBadge status={plan.status} />
      </div>

      <Separator />

      {/* Markdown Content from file */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
          <Loader2 className="size-3.5 animate-spin" />
          {t('plan.loading', { defaultValue: 'Loading plan...' })}
        </div>
      ) : fileContent ? (
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            {t('plan.document', { defaultValue: 'Plan Document' })}
          </p>
          <div className="rounded-md border bg-muted/30 p-3 text-xs prose prose-sm dark:prose-invert max-w-none prose-headings:text-xs prose-headings:font-semibold prose-pre:text-[10px] overflow-auto max-h-[400px]">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {fileContent}
            </ReactMarkdown>
          </div>
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {plan.status === 'approved' && !isRunning && (
          <Button
            size="sm"
            className="h-7 gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
            onClick={handleImplement}
          >
            <Play className="size-3" />
            {t('plan.implement', { defaultValue: 'Implement' })}
          </Button>
        )}
        {(plan.status === 'approved' || plan.status === 'implementing') && !planMode && !isRunning && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5"
            onClick={handleEditPlan}
          >
            <PenLine className="size-3" />
            {t('plan.edit', { defaultValue: 'Edit Plan' })}
          </Button>
        )}
      </div>

      {/* Drafting indicator */}
      {plan.status === 'drafting' && planMode && (
        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/5 rounded-md px-3 py-2">
          <Loader2 className="size-3.5 animate-spin" />
          {t('plan.drafting', { defaultValue: 'Plan is being drafted...' })}
        </div>
      )}
    </div>
  )
}

export function PlanPanel(): React.JSX.Element {
  const { t } = useTranslation('cowork')
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const plan = usePlanStore((s) => {
    if (!activeSessionId) return undefined
    return Object.values(s.plans).find((p) => p.sessionId === activeSessionId)
  })
  const planMode = useUIStore((s) => s.planMode)
  const enterPlanMode = useUIStore((s) => s.enterPlanMode)
  const isRunning = useAgentStore((s) => activeSessionId ? s.runningSessions[activeSessionId] === 'running' : false)

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ClipboardList className="mb-3 size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          {t('plan.noPlan', { defaultValue: 'No plan for this session' })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          {t('plan.noPlanDesc', { defaultValue: 'Enter Plan Mode to create an implementation plan before coding.' })}
        </p>
        {!planMode && !isRunning && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4 h-7 gap-1.5 text-xs"
            onClick={() => enterPlanMode()}
          >
            <ClipboardList className="size-3" />
            {t('plan.enterPlanMode', { defaultValue: 'Enter Plan Mode' })}
          </Button>
        )}
      </div>
    )
  }

  return <PlanContent plan={plan} />
}
