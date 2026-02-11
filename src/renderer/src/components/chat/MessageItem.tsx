import type { UnifiedMessage, ToolResultContent, ImageBlock } from '@renderer/lib/api/types'
import { UserMessage } from './UserMessage'
import { AssistantMessage } from './AssistantMessage'

interface MessageItemProps {
  message: UnifiedMessage
  isStreaming?: boolean
  isLastUserMessage?: boolean
  onEditUserMessage?: (newContent: string) => void
  toolResults?: Map<string, { content: ToolResultContent; isError?: boolean }>
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function MessageItem({ message, isStreaming, isLastUserMessage, onEditUserMessage, toolResults }: MessageItemProps): React.JSX.Element | null {
  const inner = (() => {
    switch (message.role) {
      case 'user': {
        // Extract user text and images from complex content (ignore tool_result blocks)
        let userText: string
        let userImages: ImageBlock[] = []
        if (typeof message.content === 'string') {
          userText = message.content
        } else {
          const textBlocks = message.content.filter((b) => b.type === 'text')
          userText = textBlocks.length > 0 ? textBlocks.map((b) => b.text).join('\n') : ''
          userImages = message.content.filter((b): b is ImageBlock => b.type === 'image')
        }
        if (!userText && userImages.length === 0) return null
        return (
          <UserMessage
            content={userText}
            images={userImages}
            isLast={isLastUserMessage}
            onEdit={onEditUserMessage}
          />
        )
      }
      case 'assistant':
        return <AssistantMessage content={message.content} isStreaming={isStreaming} usage={message.usage} toolResults={toolResults} msgId={message.id} />
      default:
        return null
    }
  })()

  if (!inner) return null

  return (
    <div className="group/ts relative">
      <span className="absolute -left-12 top-1 hidden group-hover/ts:block text-[10px] text-muted-foreground/40 whitespace-nowrap">
        {formatTime(message.createdAt)}
      </span>
      {inner}
    </div>
  )
}
