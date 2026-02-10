import { Avatar, AvatarFallback } from '@renderer/components/ui/avatar'
import { User } from 'lucide-react'

interface UserMessageProps {
  content: string
}

export function UserMessage({ content }: UserMessageProps): React.JSX.Element {
  return (
    <div className="flex gap-3">
      <Avatar className="size-7 shrink-0">
        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
          <User className="size-3.5" />
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-medium mb-1">You</p>
        <div className="text-sm whitespace-pre-wrap">{content}</div>
      </div>
    </div>
  )
}
