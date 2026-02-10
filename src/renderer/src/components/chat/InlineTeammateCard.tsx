import * as React from 'react'
import {
  Users,
  Wrench,
  ChevronDown,
  ChevronRight,
  Clock,
  Square,
  Loader2,
  CheckCircle2,
  Maximize2,
} from 'lucide-react'
import { Badge } from '@renderer/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@renderer/components/ui/collapsible'
import { useTeamStore } from '@renderer/stores/team-store'
import { abortTeammate } from '@renderer/lib/agent/teams/teammate-runner'
import { ToolCallCard } from './ToolCallCard'
import { cn } from '@renderer/lib/utils'
import { useUIStore } from '@renderer/stores/ui-store'


function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const secs = ms / 1000
  if (secs < 60) return `${secs.toFixed(1)}s`
  return `${Math.floor(secs / 60)}m${Math.round(secs % 60)}s`
}

interface InlineTeammateCardProps {
  /** Input from the SpawnTeammate tool call */
  input: Record<string, unknown>
  /** Tool result output (contains member_id) */
  output?: string
}

function parseOutput(output?: string): Record<string, unknown> | null {
  if (!output) return null
  try {
    return JSON.parse(output)
  } catch {
    return null
  }
}

export function InlineTeammateCard({ input, output }: InlineTeammateCardProps): React.JSX.Element {
  const [toolsExpanded, setToolsExpanded] = React.useState(true)
  const parsed = parseOutput(output)
  const memberId = parsed?.member_id ? String(parsed.member_id) : null
  const isError = parsed && 'error' in parsed
  const memberName = String(input.name ?? '')
  const taskId = input.task_id ? String(input.task_id) : null

  // Read live state from team-store
  const member = useTeamStore((s) =>
    memberId ? s.activeTeam?.members.find((m) => m.id === memberId) ?? null : null
  )
  const task = useTeamStore((s) => {
    if (!member?.currentTaskId || !s.activeTeam) return null
    return s.activeTeam.tasks.find((t) => t.id === member.currentTaskId) ?? null
  })

  const isWorking = member?.status === 'working'
  const isCompleted = member?.status === 'stopped'

  // Live elapsed time
  const [now, setNow] = React.useState(Date.now())
  React.useEffect(() => {
    if (!isWorking) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [isWorking])

  const elapsed = member
    ? (member.completedAt ?? now) - member.startedAt
    : null

  // If the tool returned an error (e.g. duplicate name), show a compact error card
  if (isError) {
    return (
      <div className="my-5 rounded-xl border-2 border-destructive/30 bg-destructive/5 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-destructive" />
          <span className="text-sm font-medium text-destructive">SpawnTeammate failed</span>
        </div>
        <p className="text-xs text-muted-foreground/70 mt-1">{String(parsed?.error ?? '')}</p>
      </div>
    )
  }

  // Before output arrives (still executing), show a pending state
  if (!member) {
    return (
      <div className="my-5 rounded-xl border-2 border-cyan-500/20 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center rounded-lg bg-cyan-500/15 p-1.5 text-cyan-500">
            <Users className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-cyan-600 dark:text-cyan-400">{memberName || 'Teammate'}</span>
              <Badge variant="secondary" className="text-[9px] px-1.5 h-4">spawning</Badge>
            </div>
            {taskId && (
              <p className="text-xs text-muted-foreground/60 mt-0.5">Task #{taskId}</p>
            )}
          </div>
          <Loader2 className="size-3.5 animate-spin text-cyan-400" />
        </div>
      </div>
    )
  }

  const handleOpenDetail = (): void => {
    useUIStore.getState().openDetailPanel({ type: 'team' })
  }

  // Full inline card with live state
  return (
    <div
      className={cn(
        'my-5 rounded-xl border-2 overflow-hidden transition-all duration-300',
        isWorking && 'border-cyan-500/40 shadow-lg shadow-cyan-500/5',
        isCompleted && 'border-cyan-500/20',
        !isWorking && !isCompleted && 'border-muted',
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center gap-2.5 px-4 py-2.5',
          isWorking && 'bg-cyan-500/5',
          isCompleted && 'bg-cyan-500/[0.02]',
        )}
      >
        <div className={cn(
          'flex items-center justify-center rounded-lg p-1.5',
          isWorking ? 'bg-cyan-500/15 text-cyan-500' : 'bg-muted text-muted-foreground',
        )}>
          <Users className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-cyan-600 dark:text-cyan-400">{member.name}</span>
            <Badge
              variant={isWorking ? 'default' : 'secondary'}
              className={cn('text-[9px] px-1.5 h-4', isWorking && 'bg-cyan-500 animate-pulse')}
            >
              {member.status}
            </Badge>
            {member.model !== 'default' && (
              <span className="text-[9px] text-muted-foreground/40">{member.model}</span>
            )}
          </div>
          {task && (
            <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{task.subject}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 text-[10px] text-muted-foreground/50">
          {member.iteration > 0 && (
            <>
              <span className="tabular-nums">iter {member.iteration}</span>
              <span>·</span>
            </>
          )}
          {member.toolCalls.length > 0 && (
            <>
              <span className="tabular-nums">{member.toolCalls.length} calls</span>
              <span>·</span>
            </>
          )}
          {elapsed != null && (
            <span className="tabular-nums flex items-center gap-0.5">
              <Clock className="size-2.5" />
              {formatElapsed(elapsed)}
            </span>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); handleOpenDetail() }}
          className="rounded-md p-1 text-muted-foreground/30 hover:text-cyan-500 hover:bg-cyan-500/10 transition-colors shrink-0"
          title="View team details"
        >
          <Maximize2 className="size-3.5" />
        </button>
      </div>

      {/* Tool Calls (collapsible) */}
      {member.toolCalls.length > 0 && (
        <Collapsible open={toolsExpanded} onOpenChange={setToolsExpanded}>
          <div className="border-t border-cyan-500/10 px-4 py-1.5">
            <CollapsibleTrigger asChild>
              <button className="flex w-full items-center gap-1.5 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                <Wrench className="size-2.5" />
                <span className="font-medium uppercase tracking-wider">Tool Calls</span>
                <Badge variant="secondary" className="text-[9px] h-3.5 px-1 ml-0.5">{member.toolCalls.length}</Badge>
                <span className="flex-1" />
                {toolsExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1 space-y-1">
                {member.toolCalls.map((tc) => (
                  <ToolCallCard
                    key={tc.id}
                    name={tc.name}
                    input={tc.input}
                    output={tc.output}
                    status={tc.status}
                    error={tc.error}
                    startedAt={tc.startedAt}
                    completedAt={tc.completedAt}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* Streaming text (live thinking) */}
      {isWorking && member.streamingText && (
        <div className="border-t border-cyan-500/10 px-4 py-2.5 max-h-48 overflow-y-auto">
          <p className="text-xs text-muted-foreground/70 leading-relaxed whitespace-pre-wrap break-words">
            {member.streamingText.length > 800
              ? `…${member.streamingText.slice(-800)}`
              : member.streamingText}
          </p>
          <span className="inline-block w-1 h-3 bg-cyan-500/60 animate-pulse ml-0.5" />
        </div>
      )}

      {/* Thinking indicator */}
      {isWorking && member.toolCalls.length === 0 && !member.streamingText && (
        <div className="border-t border-cyan-500/10 px-4 py-2 flex items-center gap-2">
          <span className="flex gap-1">
            <span className="size-1.5 rounded-full bg-cyan-400/50 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="size-1.5 rounded-full bg-cyan-400/50 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="size-1.5 rounded-full bg-cyan-400/50 animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
          <span className="text-[11px] text-cyan-400/60">Working...</span>
        </div>
      )}

      {/* Footer — running state */}
      {isWorking && (
        <div className="border-t border-cyan-500/10 px-4 py-1.5 flex items-center gap-2">
          <Loader2 className="size-3 animate-spin text-cyan-400" />
          <span className="text-[10px] text-cyan-400/70 font-medium flex-1">
            {member.name} is working...
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); abortTeammate(member.id) }}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] text-muted-foreground/50 hover:text-destructive hover:bg-destructive/5 transition-colors"
          >
            <Square className="size-2.5" />
            Stop
          </button>
        </div>
      )}

      {/* Footer — completed summary */}
      {isCompleted && (
        <div className="border-t border-cyan-500/10 px-4 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="size-3 text-green-500" />
            <span className="text-[10px] text-green-500/80 font-medium">Completed</span>
            <span className="text-[9px] text-muted-foreground/40">
              {member.iteration} iters · {member.toolCalls.length} calls
              {elapsed != null && <> · {formatElapsed(elapsed)}</>}
            </span>
          </div>
          {member.streamingText && (
            <p className="text-[11px] text-muted-foreground/60 leading-snug whitespace-pre-wrap break-words">
              {member.streamingText.length > 200
                ? member.streamingText.slice(-200) + '…'
                : member.streamingText}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
