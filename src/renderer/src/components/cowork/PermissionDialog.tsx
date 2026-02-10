import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog'
import { Badge } from '@renderer/components/ui/badge'
import { ShieldAlert } from 'lucide-react'
import type { ToolCallState } from '@renderer/lib/agent/types'

interface PermissionDialogProps {
  toolCall: ToolCallState | null
  onAllow: () => void
  onDeny: () => void
}

export function PermissionDialog({
  toolCall,
  onAllow,
  onDeny,
}: PermissionDialogProps): React.JSX.Element {
  return (
    <AlertDialog open={!!toolCall}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-amber-500" />
            Permission Required
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                The assistant wants to execute{' '}
                <Badge variant="secondary" className="font-mono">
                  {toolCall?.name}
                </Badge>
              </p>
              {toolCall && (
                <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(toolCall.input, null, 2)}
                </pre>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDeny}>Deny</AlertDialogCancel>
          <AlertDialogAction onClick={onAllow}>Allow</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
