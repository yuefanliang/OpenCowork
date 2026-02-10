import * as React from 'react'
import { ChevronDown, ChevronRight, CheckCircle2, Loader2, XCircle, Clock } from 'lucide-react'
import { Badge } from '@renderer/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@renderer/components/ui/collapsible'
import { cn } from '@renderer/lib/utils'
import type { ToolCallStatus } from '@renderer/lib/agent/types'

interface ToolCallCardProps {
  name: string
  input: Record<string, unknown>
  output?: string
  status: ToolCallStatus | 'completed'
  error?: string
}

function StatusIcon({ status }: { status: ToolCallCardProps['status'] }): React.JSX.Element {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="size-3.5 text-green-500" />
    case 'running':
      return <Loader2 className="size-3.5 animate-spin text-blue-500" />
    case 'error':
      return <XCircle className="size-3.5 text-destructive" />
    case 'pending_approval':
      return <Clock className="size-3.5 text-amber-500" />
    default:
      return <Clock className="size-3.5 text-muted-foreground" />
  }
}

function inputSummary(input: Record<string, unknown>): string {
  const keys = Object.keys(input)
  if (keys.length === 0) return ''
  const first = input[keys[0]]
  const val = typeof first === 'string' ? first : JSON.stringify(first)
  const truncated = val.length > 60 ? val.slice(0, 60) + '…' : val
  return truncated
}

export function ToolCallCard({
  name,
  input,
  output,
  status,
  error,
}: ToolCallCardProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors',
            'hover:bg-muted/50',
            status === 'error' && 'border-destructive/30 bg-destructive/5'
          )}
        >
          <StatusIcon status={status} />
          <Badge variant="outline" className="font-mono text-xs">
            {name}
          </Badge>
          {!open && (
            <span className="flex-1 truncate text-xs text-muted-foreground/60 font-mono">
              {inputSummary(input)}
            </span>
          )}
          {open && <span className="flex-1" />}
          {open ? (
            <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 space-y-2 rounded-md border bg-muted/30 p-3">
          {/* Input */}
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Input</p>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs font-mono">
              {JSON.stringify(input, null, 2)}
            </pre>
          </div>
          {/* Output */}
          {output && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Output</p>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs font-mono">{output}</pre>
            </div>
          )}
          {/* Error */}
          {error && (
            <div>
              <p className="mb-1 text-xs font-medium text-destructive">Error</p>
              <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words text-xs text-destructive font-mono">{error}</pre>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
