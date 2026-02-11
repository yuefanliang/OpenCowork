import * as React from 'react'
import { useChatStore } from '@renderer/stores/chat-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { useAgentStore } from '@renderer/stores/agent-store'
import { MessageItem } from './MessageItem'
import { MessageSquare, Briefcase, Code2, RefreshCw, ArrowDown, ClipboardCopy, Check, ImageDown, Loader2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { sessionToMarkdown } from '@renderer/lib/utils/export-chat'
import { toPng } from 'html-to-image'
import type { ToolResultContent } from '@renderer/lib/api/types'
import { toast } from 'sonner'
import appIconUrl from '../../../../../resources/icon.png'

const modeHints = {
  chat: {
    icon: <MessageSquare className="size-12 text-muted-foreground/20" />,
    title: 'Start a conversation',
    description: 'Ask anything — no tools, just chat.',
  },
  cowork: {
    icon: <Briefcase className="size-12 text-muted-foreground/20" />,
    title: 'Start a Cowork session',
    description: 'Select a working folder, then ask the assistant to help with your project.',
  },
  code: {
    icon: <Code2 className="size-12 text-muted-foreground/20" />,
    title: 'Start coding',
    description: 'Describe what you want to build and the assistant will write the code.',
  },
}

interface MessageListProps {
  onRetry?: () => void
  onEditUserMessage?: (newContent: string) => void
}

export function MessageList({ onRetry, onEditUserMessage }: MessageListProps): React.JSX.Element {
  const sessions = useChatStore((s) => s.sessions)
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const streamingMessageId = useChatStore((s) => s.streamingMessageId)
  const mode = useUIStore((s) => s.mode)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const bottomRef = React.useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = React.useState(true)
  const isStreamingRef = React.useRef(false)
  isStreamingRef.current = !!streamingMessageId

  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const messages = activeSession?.messages ?? []
  const [copiedAll, setCopiedAll] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const contentRef = React.useRef<HTMLDivElement>(null)

  // Derive a scroll trigger from streaming content length
  const streamingMsg = streamingMessageId ? messages.find((m) => m.id === streamingMessageId) : null
  const streamContentLen = streamingMsg
    ? typeof streamingMsg.content === 'string'
      ? streamingMsg.content.length
      : JSON.stringify(streamingMsg.content).length
    : 0

  // Track tool call state changes as additional scroll trigger
  // (tool cards render/expand during streaming → running → completed transitions)
  const executedToolCalls = useAgentStore((s) => s.executedToolCalls)
  const pendingToolCalls = useAgentStore((s) => s.pendingToolCalls)
  const toolCallFingerprint = React.useMemo(() => {
    const parts: string[] = []
    for (const tc of executedToolCalls) parts.push(`${tc.id}:${tc.status}`)
    for (const tc of pendingToolCalls) parts.push(`${tc.id}:${tc.status}`)
    return parts.join(',')
  }, [executedToolCalls, pendingToolCalls])

  // Track if user is near the bottom via scroll position
  // Use larger threshold during streaming so rapid content growth doesn't break auto-scroll
  React.useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = (): void => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
      const threshold = isStreamingRef.current ? 150 : 16
      setIsAtBottom(distanceFromBottom <= threshold)
    }

    handleScroll()
    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [messages.length])

  // Auto-scroll to bottom on new messages, streaming content, and tool call state changes
  React.useEffect(() => {
    if (!isAtBottom) return
    const container = scrollContainerRef.current
    if (!container) return

    if (isStreamingRef.current) {
      // Instant scroll during streaming — smooth animation can't keep up with rapid updates
      container.scrollTop = container.scrollHeight
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length, streamingMessageId, streamContentLen, toolCallFingerprint, isAtBottom])

  // Follow DOM height changes during streaming (covers typewriter-driven growth
  // that happens between store updates and is not caught by streamContentLen).
  React.useEffect(() => {
    if (!streamingMessageId) return
    const container = scrollContainerRef.current
    if (!container) return

    let lastHeight = container.scrollHeight
    let rafId: number

    const follow = (): void => {
      const h = container.scrollHeight
      if (h !== lastHeight) {
        lastHeight = h
        const dist = h - container.scrollTop - container.clientHeight
        if (dist <= 150) container.scrollTop = h
      }
      rafId = requestAnimationFrame(follow)
    }

    rafId = requestAnimationFrame(follow)
    return () => cancelAnimationFrame(rafId)
  }, [streamingMessageId])

  const scrollToBottom = React.useCallback(() => {
    const container = scrollContainerRef.current
    if (container) container.scrollTop = container.scrollHeight
  }, [])

  if (messages.length === 0) {
    const hint = modeHints[mode]
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center px-6">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-2xl bg-muted/40 p-4">
            {hint.icon}
          </div>
          <div>
            <p className="text-base font-semibold text-foreground/80">{hint.title}</p>
            <p className="mt-1.5 text-sm text-muted-foreground/60 max-w-[320px]">{hint.description}</p>
          </div>
        </div>
        {mode !== 'chat' && (
          <p className="text-[11px] text-muted-foreground/40">
            Tip: Drop files into the input to reference their paths
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-2 max-w-[400px]">
          {(mode === 'chat' ? [
            'Explain how async/await works',
            'Compare REST vs GraphQL',
            'Write a regex for email validation',
          ] : mode === 'cowork' ? (activeSession?.workingFolder ? [
            'Summarize this project structure',
            'Find and fix potential bugs',
            'Add error handling to the main module',
          ] : [
            'Review this codebase and suggest improvements',
            'Add tests for the main module',
            'Refactor for better error handling',
          ]) : (activeSession?.workingFolder ? [
            'Add a new feature that...',
            'Write tests for the existing code',
            'Optimize the performance of...',
          ] : [
            'Build a CLI tool that...',
            'Create a REST API with...',
            'Write a script that...',
          ])).map((prompt) => (
            <button
              key={prompt}
              className="rounded-lg border bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors"
              onClick={() => {
                const textarea = document.querySelector('textarea')
                if (textarea) {
                  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
                  nativeInputValueSetter?.call(textarea, prompt)
                  textarea.dispatchEvent(new Event('input', { bubbles: true }))
                  textarea.focus()
                }
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
        <div className="mt-1 rounded-xl border bg-muted/30 px-5 py-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11px]">
            <div className="flex items-center gap-2"><kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">Ctrl+N</kbd><span className="text-muted-foreground/60">New chat</span></div>
            <div className="flex items-center gap-2"><kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">Ctrl+K</kbd><span className="text-muted-foreground/60">Commands</span></div>
            <div className="flex items-center gap-2"><kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">Ctrl+B</kbd><span className="text-muted-foreground/60">Sidebar</span></div>
            <div className="flex items-center gap-2"><kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">Ctrl+/</kbd><span className="text-muted-foreground/60">Shortcuts</span></div>
            <div className="flex items-center gap-2"><kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">Ctrl+,</kbd><span className="text-muted-foreground/60">Settings</span></div>
            <div className="flex items-center gap-2"><kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">Ctrl+D</kbd><span className="text-muted-foreground/60">Duplicate</span></div>
          </div>
        </div>
      </div>
    )
  }

  const handleCopyAll = (): void => {
    if (!activeSession) return
    const md = sessionToMarkdown(activeSession)
    navigator.clipboard.writeText(md)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  const handleExportImage = async (): Promise<void> => {
    const node = contentRef.current
    if (!node || !activeSession) return
    setExporting(true)

    // Convert app icon to base64 data URL for embedding in the footer
    let iconDataUrl = ''
    try {
      const resp = await fetch(appIconUrl)
      const blob = await resp.blob()
      iconDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } catch {
      // Silently skip icon if it fails to load
    }

    // Build and inject footer DOM element
    const footer = document.createElement('div')
    footer.setAttribute('data-export-footer', '1')
    footer.style.cssText = 'margin-top:24px;padding:20px 0 8px;border-top:1px solid rgba(128,128,128,0.2);display:flex;align-items:center;justify-content:center;gap:14px;'
    footer.innerHTML = [
      iconDataUrl
        ? `<img src="${iconDataUrl}" style="width:40px;height:40px;border-radius:8px;flex-shrink:0;" />`
        : '',
      '<div style="display:flex;flex-direction:column;justify-content:center;gap:2px;">',
      '  <span style="font-weight:600;font-size:14px;color:rgba(128,128,128,0.75);">OpenCowork</span>',
      '  <span style="font-size:11px;color:rgba(128,128,128,0.5);">AI-Powered Collaborative Development Platform</span>',
      '  <span style="font-size:11px;color:rgba(128,128,128,0.45);">github.com/AIDotNet/OpenCowork</span>',
      '</div>',
    ].join('\n')
    node.appendChild(footer)

    try {
      // Wait for browser to layout the footer before capturing
      await new Promise((r) => setTimeout(r, 150))

      const bgRaw = getComputedStyle(document.documentElement).getPropertyValue('--background').trim()
      const bgColor = bgRaw ? `hsl(${bgRaw})` : '#ffffff'
      const dataUrl = await toPng(node, { backgroundColor: bgColor, pixelRatio: 2 })

      const base64 = dataUrl.split(',')[1]
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'image/png' })
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      toast.success('图片已复制到剪贴板', { description: '可直接粘贴到聊天或文档中' })
    } catch (err) {
      console.error('Export image failed:', err)
      toast.error('导出图片失败', { description: String(err) })
    } finally {
      if (node.contains(footer)) node.removeChild(footer)
      setExporting(false)
    }
  }

  return (
    <div className="relative flex-1">
      {/* Floating action bar — always visible at top-right, icons only until hovered */}
      {messages.length > 1 && !streamingMessageId && (
        <div className="absolute top-2 right-4 z-10 flex items-center gap-0.5 rounded-lg border bg-background/80 backdrop-blur-sm shadow-sm px-0.5 py-0.5">
          <button
            className="group/btn flex h-6 items-center gap-1 rounded-md px-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200 disabled:opacity-50"
            onClick={handleExportImage}
            disabled={exporting}
          >
            {exporting ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : <ImageDown className="size-3.5 shrink-0" />}
            <span className="overflow-hidden max-w-0 group-hover/btn:max-w-[80px] transition-all duration-200 text-[10px] whitespace-nowrap">
              {exporting ? 'Exporting...' : 'Export Image'}
            </span>
          </button>
          <button
            className="group/btn flex h-6 items-center gap-1 rounded-md px-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200"
            onClick={handleCopyAll}
          >
            {copiedAll ? <Check className="size-3.5 shrink-0" /> : <ClipboardCopy className="size-3.5 shrink-0" />}
            <span className="overflow-hidden max-w-0 group-hover/btn:max-w-[60px] transition-all duration-200 text-[10px] whitespace-nowrap">
              {copiedAll ? 'Copied!' : 'Copy All'}
            </span>
          </button>
        </div>
      )}
      <div ref={scrollContainerRef} className="absolute inset-0 overflow-y-auto">
        <div ref={contentRef} className="mx-auto max-w-3xl space-y-6 p-4 overflow-hidden">
          {messages.map((msg, idx) => {
            // Hide intermediate user messages that only contain tool_result blocks
            // (they are API-level responses, not real user input — output already shown in ToolCallCard)
            if (msg.role === 'user' && Array.isArray(msg.content)) {
              const hasOnlyToolResults = msg.content.every((b) => b.type === 'tool_result')
              if (hasOnlyToolResults) return null
            }
            // Check if this is the last *real* user message (exclude tool_result-only messages)
            const isRealUserMsg = (m: typeof msg): boolean =>
              m.role === 'user' && (typeof m.content === 'string' || m.content.some((b) => b.type === 'text'))
            const isLastUser = !streamingMessageId && isRealUserMsg(msg) &&
              !messages.slice(idx + 1).some((m) => isRealUserMsg(m))
            // Build tool results map for assistant messages.
            // Scan ALL consecutive tool_result-only user messages after this assistant message,
            // because multi-iteration agent loops append to a single assistant message but
            // create separate user messages for each iteration's tool results.
            let toolResults: Map<string, { content: ToolResultContent; isError?: boolean }> | undefined
            if (msg.role === 'assistant' && Array.isArray(msg.content)) {
              for (let i = idx + 1; i < messages.length; i++) {
                const nextMsg = messages[i]
                if (nextMsg.role !== 'user' || !Array.isArray(nextMsg.content)) break
                const hasOnlyToolResults = nextMsg.content.every((b) => b.type === 'tool_result')
                if (!hasOnlyToolResults) break
                if (!toolResults) toolResults = new Map()
                for (const block of nextMsg.content) {
                  if (block.type === 'tool_result') {
                    toolResults.set(block.toolUseId, { content: block.content, isError: block.isError })
                  }
                }
              }
            }
            return (
              <MessageItem
                key={msg.id}
                message={msg}
                isStreaming={msg.id === streamingMessageId}
                isLastUserMessage={isLastUser}
                onEditUserMessage={onEditUserMessage}
                toolResults={toolResults}
              />
            )
          })}
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

      {/* Scroll to bottom button */}
      {!isAtBottom && messages.length > 0 && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 flex items-center gap-1.5 rounded-full border bg-background/90 backdrop-blur-sm px-3 py-1.5 text-xs text-muted-foreground shadow-lg hover:text-foreground hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
        >
          <ArrowDown className="size-3" />
          Scroll to bottom
        </button>
      )}
    </div>
  )
}
