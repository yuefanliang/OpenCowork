import { FileText, FilePen, CheckCircle2, XCircle } from 'lucide-react'
import { useAgentStore } from '@renderer/stores/agent-store'

const FILE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit'])

export function ArtifactsPanel(): React.JSX.Element {
  const executedToolCalls = useAgentStore((s) => s.executedToolCalls)

  const fileOps = executedToolCalls.filter((tc) => FILE_TOOLS.has(tc.name))

  if (fileOps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="mb-3 size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No artifacts yet</p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Files created or edited by the assistant will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {fileOps.map((tc) => {
        const filePath = String(tc.input.file_path ?? tc.input.path ?? '')
        const fileName = filePath.split(/[\\/]/).pop() || filePath
        const isError = tc.status === 'error'

        return (
          <div
            key={tc.id}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
            title={filePath}
          >
            {tc.name === 'Write' ? (
              <FileText className="size-3.5 shrink-0 text-blue-500" />
            ) : (
              <FilePen className="size-3.5 shrink-0 text-amber-500" />
            )}
            <span className="min-w-0 flex-1 truncate">{fileName}</span>
            {isError ? (
              <XCircle className="size-3.5 shrink-0 text-destructive" />
            ) : (
              <CheckCircle2 className="size-3.5 shrink-0 text-green-500" />
            )}
          </div>
        )
      })}
    </div>
  )
}
