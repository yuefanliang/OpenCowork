import * as React from 'react'
import {
  X,
  FileText,
  Users,
  Bot,
  Clock,
  ChevronDown,
  ChevronRight,
  Wrench,
  History,
} from 'lucide-react'
import { useUIStore } from '@renderer/stores/ui-store'
import { useTeamStore, type ActiveTeam } from '@renderer/stores/team-store'
import { useAgentStore, type SubAgentState } from '@renderer/stores/agent-store'
import { TeamPanel } from '@renderer/components/cowork/TeamPanel'
import { ToolCallCard } from '@renderer/components/chat/ToolCallCard'
import { Separator } from '@renderer/components/ui/separator'
import { Badge } from '@renderer/components/ui/badge'
import { cn } from '@renderer/lib/utils'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ── Helpers ──────────────────────────────────────────────────────

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const secs = ms / 1000
  if (secs < 60) return `${secs.toFixed(1)}s`
  return `${Math.floor(secs / 60)}m${Math.round(secs % 60)}s`
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString()
}

// ── Team History View ────────────────────────────────────────────

function TeamHistoryItem({ team, isExpanded, onToggle }: {
  team: ActiveTeam
  isExpanded: boolean
  onToggle: () => void
}): React.JSX.Element {
  const completedTasks = team.tasks.filter((t) => t.status === 'completed').length
  return (
    <div className="rounded-lg border border-muted overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
      >
        <Users className="size-3.5 text-cyan-500 shrink-0" />
        <span className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 truncate flex-1">
          {team.name}
        </span>
        <span className="text-[9px] text-muted-foreground/50">{team.members.length} members</span>
        <span className="text-[9px] text-muted-foreground/50">{completedTasks}/{team.tasks.length} tasks</span>
        <span className="text-[9px] text-muted-foreground/40">{formatDate(team.createdAt)}</span>
        {isExpanded ? <ChevronDown className="size-3 text-muted-foreground/40" /> : <ChevronRight className="size-3 text-muted-foreground/40" />}
      </button>
      {isExpanded && (
        <div className="border-t border-muted px-3 py-2 space-y-2">
          <p className="text-[10px] text-muted-foreground/60">{team.description}</p>

          {/* Members summary */}
          {team.members.length > 0 && (
            <div>
              <span className="text-[9px] font-medium text-muted-foreground/50 uppercase tracking-wider">Members</span>
              <div className="mt-1 space-y-1">
                {team.members.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 text-[10px]">
                    <span className={cn(
                      'size-1.5 rounded-full shrink-0',
                      m.status === 'working' ? 'bg-green-500 animate-pulse' : m.status === 'stopped' ? 'bg-muted-foreground/30' : 'bg-cyan-400',
                    )} />
                    <span className="font-medium text-cyan-600 dark:text-cyan-400">{m.name}</span>
                    <span className="text-muted-foreground/40">{m.toolCalls.length} calls</span>
                    <span className="text-muted-foreground/40">{m.iteration} iters</span>
                    {m.completedAt && m.startedAt && (
                      <span className="text-muted-foreground/30">{formatElapsed(m.completedAt - m.startedAt)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tasks summary */}
          {team.tasks.length > 0 && (
            <div>
              <span className="text-[9px] font-medium text-muted-foreground/50 uppercase tracking-wider">Tasks</span>
              <div className="mt-1 space-y-0.5">
                {team.tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-1.5 text-[10px]">
                    <Badge variant="secondary" className={cn(
                      'text-[7px] h-3 px-1',
                      t.status === 'completed' ? 'bg-green-500/15 text-green-500' :
                      t.status === 'in_progress' ? 'bg-blue-500/15 text-blue-500' :
                      'bg-muted text-muted-foreground/60',
                    )}>
                      {t.status === 'completed' ? 'done' : t.status === 'in_progress' ? 'active' : 'pending'}
                    </Badge>
                    <span className="truncate text-muted-foreground/70">{t.subject}</span>
                    {t.owner && <span className="text-cyan-500/50 shrink-0">{t.owner}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages count */}
          {team.messages.length > 0 && (
            <span className="text-[9px] text-muted-foreground/40">{team.messages.length} messages exchanged</span>
          )}
        </div>
      )}
    </div>
  )
}

function TeamDetailView(): React.JSX.Element {
  const teamHistory = useTeamStore((s) => s.teamHistory)
  const [expandedIdx, setExpandedIdx] = React.useState<number | null>(null)

  return (
    <div className="space-y-3">
      {/* Active team */}
      <TeamPanel />

      {/* History */}
      {teamHistory.length > 0 && (
        <>
          <Separator />
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <History className="size-3 text-muted-foreground/50" />
              <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">History</span>
              <Badge variant="secondary" className="text-[8px] h-3.5 px-1">{teamHistory.length}</Badge>
            </div>
            <div className="space-y-1.5">
              {teamHistory.slice().reverse().map((team, i) => (
                <TeamHistoryItem
                  key={`${team.name}-${team.createdAt}`}
                  team={team}
                  isExpanded={expandedIdx === i}
                  onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── SubAgent Detail View ─────────────────────────────────────────

function SubAgentDetailItem({ sa, defaultOpen }: { sa: SubAgentState; defaultOpen?: boolean }): React.JSX.Element {
  const [open, setOpen] = React.useState(defaultOpen ?? false)
  const elapsed = sa.completedAt && sa.startedAt ? sa.completedAt - sa.startedAt : null

  return (
    <div className="rounded-lg border border-muted overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
      >
        <Bot className="size-3.5 text-violet-500 shrink-0" />
        <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 truncate flex-1">
          {sa.name}
        </span>
        <Badge variant={sa.isRunning ? 'default' : 'secondary'} className={cn('text-[8px] h-3.5 px-1', sa.isRunning && 'bg-violet-500 animate-pulse')}>
          {sa.isRunning ? 'running' : 'done'}
        </Badge>
        <span className="text-[9px] text-muted-foreground/40">{sa.toolCalls.length} calls</span>
        {elapsed != null && (
          <span className="text-[9px] text-muted-foreground/30 flex items-center gap-0.5">
            <Clock className="size-2.5" />
            {formatElapsed(elapsed)}
          </span>
        )}
        {open ? <ChevronDown className="size-3 text-muted-foreground/40" /> : <ChevronRight className="size-3 text-muted-foreground/40" />}
      </button>
      {open && (
        <div className="border-t border-muted px-3 py-2 space-y-2">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
            <span>Iterations: {sa.iteration}</span>
            <span>·</span>
            <span>Tool calls: {sa.toolCalls.length}</span>
            {elapsed != null && <><span>·</span><span>{formatElapsed(elapsed)}</span></>}
          </div>

          {/* Streaming text / final output */}
          {sa.streamingText && (
            <div className="rounded-md bg-violet-500/[0.03] border border-violet-500/10 px-2.5 py-2 max-h-48 overflow-y-auto">
              <p className="text-[11px] text-muted-foreground/70 leading-relaxed whitespace-pre-wrap break-words">
                {sa.streamingText.length > 1000
                  ? sa.streamingText.slice(-1000) + '…'
                  : sa.streamingText}
              </p>
            </div>
          )}

          {/* Tool Calls */}
          {sa.toolCalls.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Wrench className="size-2.5 text-muted-foreground/50" />
                <span className="text-[9px] font-medium text-muted-foreground/50 uppercase tracking-wider">Tool Calls</span>
              </div>
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {sa.toolCalls.map((tc) => (
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
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SubAgentDetailView({ toolUseId }: { toolUseId?: string }): React.JSX.Element {
  const activeSubAgents = useAgentStore((s) => s.activeSubAgents)
  const completedSubAgents = useAgentStore((s) => s.completedSubAgents)
  const subAgentHistory = useAgentStore((s) => s.subAgentHistory)

  // Current active + completed
  const currentAgents: SubAgentState[] = [
    ...Object.values(activeSubAgents),
    ...Object.values(completedSubAgents),
  ]

  // If a specific toolUseId is requested, find and highlight it
  const targeted = toolUseId
    ? currentAgents.find((sa) => sa.toolUseId === toolUseId) ?? subAgentHistory.find((sa) => sa.toolUseId === toolUseId)
    : null

  return (
    <div className="space-y-3">
      {/* Targeted SubAgent */}
      {targeted && (
        <SubAgentDetailItem sa={targeted} defaultOpen />
      )}

      {/* Current session SubAgents */}
      {currentAgents.length > 0 && !targeted && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Bot className="size-3 text-muted-foreground/50" />
            <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Current</span>
            <Badge variant="secondary" className="text-[8px] h-3.5 px-1">{currentAgents.length}</Badge>
          </div>
          <div className="space-y-1.5">
            {currentAgents.map((sa) => (
              <SubAgentDetailItem key={sa.toolUseId} sa={sa} />
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {subAgentHistory.length > 0 && (
        <>
          <Separator />
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <History className="size-3 text-muted-foreground/50" />
              <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">History</span>
              <Badge variant="secondary" className="text-[8px] h-3.5 px-1">{subAgentHistory.length}</Badge>
            </div>
            <div className="space-y-1.5">
              {subAgentHistory.slice().reverse().map((sa) => (
                <SubAgentDetailItem key={sa.toolUseId} sa={sa} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {currentAgents.length === 0 && subAgentHistory.length === 0 && !targeted && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Bot className="mb-3 size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No SubAgent records</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            SubAgent activity will appear here
          </p>
        </div>
      )}
    </div>
  )
}

// ── Main DetailPanel ─────────────────────────────────────────────

export function DetailPanel(): React.JSX.Element {
  const content = useUIStore((s) => s.detailPanelContent)
  const closeDetailPanel = useUIStore((s) => s.closeDetailPanel)

  const title = content?.type === 'team'
    ? 'Team'
    : content?.type === 'subagent'
      ? 'SubAgent'
      : content?.type === 'document'
        ? content.title
        : content?.type === 'report'
          ? content.title
          : 'Details'

  const icon = content?.type === 'team'
    ? <Users className="size-4 text-cyan-500" />
    : content?.type === 'subagent'
      ? <Bot className="size-4 text-violet-500" />
      : <FileText className="size-4 text-muted-foreground" />

  return (
    <aside className="flex w-[480px] shrink-0 flex-col border-l bg-background/50 backdrop-blur-sm">
      {/* Header */}
      <div className="flex h-10 items-center gap-2 px-3">
        {icon}
        <span className="text-sm font-medium flex-1 truncate">{title}</span>
        <button
          onClick={closeDetailPanel}
          className="rounded-md p-1 text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-colors"
          title="Close panel"
        >
          <X className="size-4" />
        </button>
      </div>
      <Separator />

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {content?.type === 'team' && <TeamDetailView />}

        {content?.type === 'subagent' && <SubAgentDetailView toolUseId={content.toolUseId} />}

        {content?.type === 'document' && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <Markdown remarkPlugins={[remarkGfm]}>
              {content.content}
            </Markdown>
          </div>
        )}

        {content?.type === 'report' && (
          <div className="space-y-3">
            <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-words">
              {JSON.stringify(content.data, null, 2)}
            </pre>
          </div>
        )}

        {!content && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="mb-3 size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No content selected</p>
          </div>
        )}
      </div>
    </aside>
  )
}
