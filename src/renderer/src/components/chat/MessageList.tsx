import * as React from 'react'
import { useChatStore } from '@renderer/stores/chat-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { MessageItem } from './MessageItem'
import { MessageSquare, Briefcase, Code2, Keyboard, RefreshCw } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'

const modeHints = {
  chat: {
    icon: <MessageSquare className="size-10 text-muted-foreground/30" />,
    title: 'Start a conversation',
    description: 'Ask anything — no tools, just chat.',
  },
  cowork: {
    icon: <Briefcase className="size-10 text-muted-foreground/30" />,
    title: 'Start a Cowork session',
    description: 'Select a working folder, then ask the assistant to help with your project.',
  },
  code: {
    icon: <Code2 className="size-10 text-muted-foreground/30" />,
    title: 'Start coding',
    description: 'Describe what you want to build and the assistant will write the code.',
  },
}

interface MessageListProps {
  onRetry?: () => void
}

export function MessageList({ onRetry }: MessageListProps): React.JSX.Element {
  const sessions = useChatStore((s) => s.sessions)
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const streamingMessageId = useChatStore((s) => s.streamingMessageId)
  const mode = useUIStore((s) => s.mode)
  const bottomRef = React.useRef<HTMLDivElement>(null)

  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const messages = activeSession?.messages ?? []

  // Derive a scroll trigger from streaming content length
  const streamingMsg = streamingMessageId ? messages.find((m) => m.id === streamingMessageId) : null
  const streamContentLen = streamingMsg
    ? typeof streamingMsg.content === 'string'
      ? streamingMsg.content.length
      : JSON.stringify(streamingMsg.content).length
    : 0

  // Auto-scroll to bottom on new messages and during streaming
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streamingMessageId, streamContentLen])

  if (messages.length === 0) {
    const hint = modeHints[mode]
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-6">
        {hint.icon}
        <div>
          <p className="text-sm font-medium text-muted-foreground">{hint.title}</p>
          <p className="mt-1 text-xs text-muted-foreground/60">{hint.description}</p>
        </div>
        <div className="mt-4 flex flex-col items-center gap-1 text-[10px] text-muted-foreground/40">
          <div className="flex items-center gap-1.5">
            <Keyboard className="size-3" />
            <span>Shortcuts</span>
          </div>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5">
            <span>Ctrl+N new chat</span>
            <span>Ctrl+B sidebar</span>
            <span>Ctrl+L clear</span>
            <span>Ctrl+, settings</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-4">
        {messages.map((msg) => (
          <MessageItem
            key={msg.id}
            message={msg}
            isStreaming={msg.id === streamingMessageId}
          />
        ))}
        {!streamingMessageId && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && onRetry && (
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground" onClick={onRetry}>
              <RefreshCw className="size-3" />
              Retry
            </Button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
