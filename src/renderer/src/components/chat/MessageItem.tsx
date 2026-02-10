import type { UnifiedMessage } from '@renderer/lib/api/types'
import { UserMessage } from './UserMessage'
import { AssistantMessage } from './AssistantMessage'

interface MessageItemProps {
  message: UnifiedMessage
  isStreaming?: boolean
}

export function MessageItem({ message, isStreaming }: MessageItemProps): React.JSX.Element | null {
  switch (message.role) {
    case 'user':
      return (
        <UserMessage
          content={typeof message.content === 'string' ? message.content : '[complex content]'}
        />
      )
    case 'assistant':
      return <AssistantMessage content={message.content} isStreaming={isStreaming} />
    default:
      return null
  }
}
