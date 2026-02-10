import { Database, FolderOpen, FolderPlus } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { useChatStore } from '@renderer/stores/chat-store'
import { ipcClient } from '@renderer/lib/ipc/ipc-client'

export function ContextPanel(): React.JSX.Element {
  const sessions = useChatStore((s) => s.sessions)
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const workingFolder = activeSession?.workingFolder

  const handleSelectFolder = async (): Promise<void> => {
    const result = (await ipcClient.invoke('fs:select-folder')) as {
      canceled?: boolean
      path?: string
    }
    if (!result.canceled && result.path && activeSessionId) {
      useChatStore.getState().setWorkingFolder(activeSessionId, result.path)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Working Folder
        </h4>
        {workingFolder ? (
          <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 truncate flex-1">{workingFolder}</span>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-xs"
            onClick={handleSelectFolder}
          >
            <FolderPlus className="size-3.5" />
            Select Working Folder
          </Button>
        )}
      </div>

      {!workingFolder && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Database className="mb-3 size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No context loaded</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Select a working folder to give the assistant access to your project
          </p>
        </div>
      )}
    </div>
  )
}
