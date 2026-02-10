import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useTaskStore } from '@renderer/stores/task-store'

interface TodoItem {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'high' | 'medium' | 'low'
}

function StatusDot({ status }: { status: TodoItem['status'] }): React.JSX.Element {
  switch (status) {
    case 'completed':
      return (
        <span className="relative flex size-3.5 shrink-0 items-center justify-center">
          <span className="size-2.5 rounded-full bg-green-500" />
        </span>
      )
    case 'in_progress':
      return (
        <span className="relative flex size-3.5 shrink-0 items-center justify-center">
          <span className="absolute size-2.5 rounded-full bg-blue-500/30 animate-ping" />
          <span className="size-2.5 rounded-full bg-blue-500" />
        </span>
      )
    case 'pending':
    default:
      return (
        <span className="relative flex size-3.5 shrink-0 items-center justify-center">
          <span className="size-2.5 rounded-full border border-muted-foreground/30" />
        </span>
      )
  }
}

interface TodoCardProps {
  input: Record<string, unknown>
  isLive?: boolean
}

export function TodoCard({ input, isLive }: TodoCardProps): React.JSX.Element {
  const [expanded, setExpanded] = React.useState(false)
  const [showPending, setShowPending] = React.useState(false)

  // Use live store state during streaming, fall back to input for historical
  const liveTodos = useTaskStore((s) => s.todos)
  const inputTodos = (input.todos ?? []) as TodoItem[]
  const todos: TodoItem[] = isLive ? liveTodos : inputTodos

  const total = todos.length
  const completed = todos.filter((t) => t.status === 'completed').length
  const hasInProgress = todos.some((t) => t.status === 'in_progress')

  // Split: visible = completed + in_progress; hidden = trailing pending (only when in_progress exists)
  const lastActiveIdx = todos.reduce((acc, t, i) => (t.status !== 'pending' ? i : acc), -1)
  const visibleTodos = hasInProgress && !showPending ? todos.slice(0, lastActiveIdx + 1) : todos
  const hiddenCount = hasInProgress && !showPending ? todos.length - (lastActiveIdx + 1) : 0

  return (
    <div className="my-5">
      {/* Header — click to toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>{completed} / {total} tasks done</span>
        <ChevronDown
          className={cn(
            'size-3 text-muted-foreground/40 transition-transform duration-200',
            !expanded && '-rotate-90'
          )}
        />
      </button>

      {/* Expanded task list */}
      {expanded && (
        <div className="mt-1.5 space-y-0.5 pl-1">
          {visibleTodos.map((todo) => (
            <div
              key={todo.id}
              className="flex items-start gap-2 py-0.5"
            >
              <span className="mt-0.5">
                <StatusDot status={todo.status} />
              </span>
              <span
                className={cn(
                  'text-xs leading-relaxed',
                  todo.status === 'completed' && 'text-muted-foreground line-through',
                  todo.status === 'pending' && 'text-muted-foreground/70'
                )}
              >
                {todo.content}
              </span>
            </div>
          ))}
          {hiddenCount > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowPending(true) }}
              className="flex items-center gap-1.5 py-0.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <span className="relative flex size-3.5 shrink-0 items-center justify-center">
                <span className="size-2.5 rounded-full border border-muted-foreground/20" />
              </span>
              {hiddenCount} more tasks...
            </button>
          )}
          {showPending && hasInProgress && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowPending(false) }}
              className="py-0.5 pl-5.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              Show less
            </button>
          )}
        </div>
      )}
    </div>
  )
}
