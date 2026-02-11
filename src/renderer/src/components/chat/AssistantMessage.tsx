import { useState, useCallback, useMemo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript'
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python'
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css'
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx'
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx'
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown'
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml'
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust'
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go'
import { Avatar, AvatarFallback } from '@renderer/components/ui/avatar'
import { useTypewriter } from '@renderer/hooks/use-typewriter'
import { Copy, Check, ChevronsDownUp, ChevronsUpDown, Bug } from 'lucide-react'
import type { ContentBlock, TokenUsage, ToolResultContent, RequestDebugInfo } from '@renderer/lib/api/types'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { ToolCallCard } from './ToolCallCard'
import { ToolCallGroup } from './ToolCallGroup'
import { FileChangeCard } from './FileChangeCard'
import { SubAgentCard } from './SubAgentCard'
import { TodoCard } from './TodoCard'
import { ThinkingBlock } from './ThinkingBlock'
import { TeamEventCard } from './TeamEventCard'
import { InlineTeammateCard } from './InlineTeammateCard'
import { TASK_TOOL_NAME } from '@renderer/lib/agent/sub-agents/create-tool'
import { TEAM_TOOL_NAMES } from '@renderer/lib/agent/teams/register'
import { useAgentStore } from '@renderer/stores/agent-store'
import { useProviderStore } from '@renderer/stores/provider-store'
import { ModelIcon } from '@renderer/components/settings/provider-icons'
import { formatTokens, calculateCost, formatCost } from '@renderer/lib/format-tokens'
import { useMemoizedTokens } from '@renderer/hooks/use-estimated-tokens'
import { getLastDebugInfo } from '@renderer/lib/debug-store'
import { MONO_FONT } from '@renderer/lib/constants'

SyntaxHighlighter.registerLanguage('typescript', typescript)
SyntaxHighlighter.registerLanguage('ts', typescript)
SyntaxHighlighter.registerLanguage('javascript', javascript)
SyntaxHighlighter.registerLanguage('js', javascript)
SyntaxHighlighter.registerLanguage('python', python)
SyntaxHighlighter.registerLanguage('bash', bash)
SyntaxHighlighter.registerLanguage('sh', bash)
SyntaxHighlighter.registerLanguage('shell', bash)
SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('css', css)
SyntaxHighlighter.registerLanguage('jsx', jsx)
SyntaxHighlighter.registerLanguage('tsx', tsx)
SyntaxHighlighter.registerLanguage('markdown', markdown)
SyntaxHighlighter.registerLanguage('md', markdown)
SyntaxHighlighter.registerLanguage('yaml', yaml)
SyntaxHighlighter.registerLanguage('yml', yaml)
SyntaxHighlighter.registerLanguage('rust', rust)
SyntaxHighlighter.registerLanguage('go', go)

interface AssistantMessageProps {
  content: string | ContentBlock[]
  isStreaming?: boolean
  usage?: TokenUsage
  /** Map of toolUseId → output for completed tool results (from next user message) */
  toolResults?: Map<string, { content: ToolResultContent; isError?: boolean }>
  msgId?: string
}

function DebugToggleButton({ debugInfo }: { debugInfo: RequestDebugInfo }): React.JSX.Element {
  const [show, setShow] = useState(false)
  const bodyFormatted = (() => {
    if (!debugInfo.body) return null
    try { return JSON.stringify(JSON.parse(debugInfo.body), null, 2) } catch { return debugInfo.body }
  })()

  return (
    <>
      <button
        onClick={() => setShow((v) => !v)}
        className={`flex items-center rounded px-1 py-0.5 transition-colors ${show ? 'text-orange-500 bg-orange-500/10' : 'text-muted-foreground hover:bg-muted-foreground/10'}`}
      >
        <Bug className="size-3.5" />
      </button>
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShow(false)}>
          <div className="w-[640px] max-w-[90vw] max-h-[80vh] rounded-lg border bg-background shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Bug className="size-3.5 text-orange-500" />
                <span className="text-xs font-medium">Request Debug</span>
              </div>
              <button onClick={() => setShow(false)} className="text-muted-foreground hover:text-foreground text-sm px-1">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 py-2 space-y-1.5 border-b text-[11px]" style={{ fontFamily: MONO_FONT }}>
                <div className="flex gap-2"><span className="text-muted-foreground/60 shrink-0">URL</span><span className="text-foreground break-all">{debugInfo.url}</span></div>
                <div className="flex gap-2"><span className="text-muted-foreground/60 shrink-0">Method</span><span className="text-foreground">{debugInfo.method}</span></div>
                <div className="flex gap-2"><span className="text-muted-foreground/60 shrink-0">Time</span><span className="text-foreground">{new Date(debugInfo.timestamp).toLocaleTimeString()}</span></div>
              </div>
              {bodyFormatted && (
                <div>
                  <div className="px-4 py-1.5 bg-muted/20 border-b flex items-center justify-between">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Request Body</span>
                    <CopyButton text={bodyFormatted} />
                  </div>
                  <SyntaxHighlighter
                    language="json"
                    style={oneDark}
                    customStyle={{ margin: 0, padding: '12px 16px', fontSize: '11px', fontFamily: MONO_FONT, background: 'transparent', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}
                    codeTagProps={{ style: { fontFamily: MONO_FONT } }}
                  >
                    {bodyFormatted}
                  </SyntaxHighlighter>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function CopyButton({ text }: { text: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted-foreground/10 transition-colors"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function CodeBlock({ language, children }: { language?: string; children: string }): React.JSX.Element {
  const code = String(children).replace(/\n$/, '')
  return (
    <div className="group relative rounded-lg border border-border/60 overflow-hidden my-3 shadow-sm">
      <div className="flex items-center justify-between bg-muted/40 px-3 py-1.5 border-b border-border/60">
        <span className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-wider">{language || 'text'}</span>
        <CopyButton text={code} />
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: '14px',
          fontSize: '12px',
          lineHeight: '1.5',
          background: 'transparent',
          fontFamily: MONO_FONT
        }}
        codeTagProps={{
          style: {
            fontFamily: 'inherit',
            fontSize: 'inherit'
          }
        }}
        className="!bg-[hsl(var(--muted))] text-xs"
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

function MarkdownContent({ text }: { text: string }): React.JSX.Element {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => (
          <a
            href={href}
            onClick={(e) => { e.preventDefault(); if (href) window.electron.ipcRenderer.invoke('shell:openExternal', href) }}
            className="text-primary underline underline-offset-2 hover:text-primary/80 cursor-pointer"
            title={href}
          >
            {children}
          </a>
        ),
        pre: ({ children }) => <>{children}</>,
        code: ({ children, className, ...props }) => {
          const match = /language-(\w+)/.exec(className || '')
          const isInline = !match && !className
          if (isInline) {
            return (
              <code
                className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono"
                style={{ fontFamily: MONO_FONT }}
                {...props}
              >
                {children}
              </code>
            )
          }
          return <CodeBlock language={match?.[1]}>{String(children)}</CodeBlock>
        },
      }}
    >
      {text}
    </Markdown>
  )
}

function StreamingMarkdownContent({ text, isStreaming }: { text: string; isStreaming: boolean }): React.JSX.Element {
  const displayed = useTypewriter(text, isStreaming)
  return <MarkdownContent text={displayed} />
}

interface ThinkSegment {
  type: 'text' | 'think'
  content: string
  closed?: boolean
}

function parseThinkTags(text: string): ThinkSegment[] {
  if (!/<think>/.test(text)) return [{ type: 'text', content: text }]

  const segments: ThinkSegment[] = []
  const regex = /<think>([\s\S]*?)(<\/think>|$)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index)
      if (before.trim()) segments.push({ type: 'text', content: before })
    }
    segments.push({ type: 'think', content: match[1], closed: match[2] === '</think>' })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex)
    if (remaining.trim()) segments.push({ type: 'text', content: remaining })
  }

  return segments.length > 0 ? segments : [{ type: 'text', content: text }]
}

function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').trim()
}

export function AssistantMessage({ content, isStreaming, usage, toolResults, msgId }: AssistantMessageProps): React.JSX.Element {
  const devMode = useSettingsStore((s) => s.devMode)
  const debugInfo = devMode && msgId ? getLastDebugInfo(msgId) : undefined
  const [toolsCollapsed, setToolsCollapsed] = useState(false)

  // Memoize the plain text extraction for token estimation (used only when no API usage)
  const plainTextForTokens = useMemo(() => {
    if (usage || isStreaming) return '' // skip expensive computation when API provides usage
    return typeof content === 'string'
      ? stripThinkTags(content)
      : content.filter((b) => b.type === 'text').map((b) => stripThinkTags(b.text)).join('\n')
  }, [content, usage, isStreaming])
  const fallbackTokens = useMemoizedTokens(plainTextForTokens)

  // Subscribe to live tool call state for real-time status during streaming
  const pendingToolCalls = useAgentStore((s) => s.pendingToolCalls)
  const executedToolCalls = useAgentStore((s) => s.executedToolCalls)
  const liveToolCallMap = useMemo(() => {
    if (!isStreaming) return null
    const map = new Map<string, (typeof executedToolCalls)[0]>()
    for (const tc of executedToolCalls) map.set(tc.id, tc)
    for (const tc of pendingToolCalls) map.set(tc.id, tc)
    return map
  }, [isStreaming, pendingToolCalls, executedToolCalls])

  const renderContent = (): React.JSX.Element => {
    // Show thinking indicator when streaming just started
    if (isStreaming && typeof content === 'string' && content.length === 0) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex gap-1">
            <span className="size-1.5 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="size-1.5 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="size-1.5 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
          <span className="text-xs text-muted-foreground/60">Thinking...</span>
        </div>
      )
    }

    if (typeof content === 'string') {
      const segments = parseThinkTags(content)
      const hasThink = segments.some((s) => s.type === 'think')

      if (!hasThink) {
        return (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <StreamingMarkdownContent text={content} isStreaming={!!isStreaming} />
            {isStreaming && <span className="inline-block w-1.5 h-4 bg-foreground/70 animate-pulse ml-0.5" />}
          </div>
        )
      }

      const lastTextSegIdx = segments.reduce((acc: number, s, idx) => (s.type === 'text' ? idx : acc), -1)
      return (
        <div className="space-y-2">
          {segments.map((seg, idx) => {
            if (seg.type === 'think') {
              return <ThinkingBlock key={idx} thinking={seg.content} isStreaming={!!isStreaming && !seg.closed} />
            }
            return (
              <div key={idx} className="prose prose-sm dark:prose-invert max-w-none">
                <StreamingMarkdownContent text={seg.content} isStreaming={!!isStreaming && idx === lastTextSegIdx} />
              </div>
            )
          })}
          {isStreaming && <span className="inline-block w-1.5 h-4 bg-foreground/70 animate-pulse ml-0.5" />}
        </div>
      )
    }

    const toolCount = content.filter((b) => b.type === 'tool_use').length
    const lastTextIdx = isStreaming
      ? content.reduce((acc: number, b, idx) => (b.type === 'text' ? idx : acc), -1)
      : -1

    // Tools that have special renderers and should NOT be grouped
    const SPECIAL_TOOLS = new Set(['TodoWrite', 'SpawnTeammate', 'Write', 'Edit', 'MultiEdit', 'Delete'])

    /** Check if a tool_use block should use the generic ToolCallCard (groupable) */
    const isGroupableTool = (name: string): boolean =>
      !SPECIAL_TOOLS.has(name) && !TEAM_TOOL_NAMES.has(name) && name !== TASK_TOOL_NAME

    // Pre-process: group consecutive same-name groupable tool_use blocks
    type RenderItem =
      | { kind: 'block'; index: number }
      | { kind: 'group'; toolName: string; indices: number[] }

    const renderItems: RenderItem[] = []
    for (let i = 0; i < content.length; i++) {
      const block = content[i]
      if (block.type === 'tool_use' && isGroupableTool(block.name)) {
        // Check if last item is a group of the same tool name
        const last = renderItems[renderItems.length - 1]
        if (last && last.kind === 'group' && last.toolName === block.name) {
          last.indices.push(i)
        } else {
          renderItems.push({ kind: 'group', toolName: block.name, indices: [i] })
        }
      } else {
        renderItems.push({ kind: 'block', index: i })
      }
    }

    /** Render a single tool_use block (special or generic) */
    const renderToolBlock = (block: Extract<ContentBlock, { type: 'tool_use' }>, key: string): React.JSX.Element | null => {
      if (toolsCollapsed) return null
      if (block.name === 'TodoWrite') {
        return <TodoCard key={key} input={block.input} isLive={!!isStreaming} />
      }
      if (block.name === 'SpawnTeammate') {
        const result = toolResults?.get(block.id)
        return <InlineTeammateCard key={key} input={block.input} output={result?.content} />
      }
      if (TEAM_TOOL_NAMES.has(block.name)) {
        const result = toolResults?.get(block.id)
        return <TeamEventCard key={key} name={block.name} input={block.input} output={result?.content} />
      }
      if (block.name === TASK_TOOL_NAME) {
        const result = toolResults?.get(block.id)
        return <SubAgentCard key={key} name={block.name} toolUseId={block.id} input={block.input} output={result?.content} isLive={!!isStreaming} />
      }
      if (['Write', 'Edit', 'MultiEdit', 'Delete'].includes(block.name)) {
        const result = toolResults?.get(block.id)
        const liveTc = liveToolCallMap?.get(block.id)
        return (
          <FileChangeCard
            key={key}
            name={block.name}
            input={block.input}
            output={liveTc?.output ?? result?.content}
            status={liveTc?.status ?? (result?.isError ? 'error' : 'completed')}
            error={liveTc?.error}
            startedAt={liveTc?.startedAt}
            completedAt={liveTc?.completedAt}
          />
        )
      }
      // Generic ToolCallCard
      const result = toolResults?.get(block.id)
      const liveTc = liveToolCallMap?.get(block.id)
      return (
        <ToolCallCard
          key={key}
          name={block.name}
          input={block.input}
          output={liveTc?.output ?? result?.content}
          status={liveTc?.status ?? (result?.isError ? 'error' : 'completed')}
          error={liveTc?.error}
          startedAt={liveTc?.startedAt}
          completedAt={liveTc?.completedAt}
        />
      )
    }

    return (
      <div className="space-y-2">
        {toolCount >= 2 && (
          <button
            onClick={() => setToolsCollapsed((v) => !v)}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted-foreground/10 transition-colors"
          >
            {toolsCollapsed ? <ChevronsUpDown className="size-3" /> : <ChevronsDownUp className="size-3" />}
            {toolsCollapsed ? `Show ${toolCount} tool calls` : `Collapse ${toolCount} tool calls`}
          </button>
        )}
        {renderItems.map((item) => {
          if (item.kind === 'block') {
            const block = content[item.index]
            switch (block.type) {
              case 'thinking':
                return (
                  <ThinkingBlock
                    key={item.index}
                    thinking={block.thinking}
                    isStreaming={isStreaming}
                    startedAt={block.startedAt}
                    completedAt={block.completedAt}
                  />
                )
              case 'text': {
                const textSegments = parseThinkTags(block.text)
                const hasThinkInBlock = textSegments.some((s) => s.type === 'think')
                if (!hasThinkInBlock) {
                  return (
                    <div key={item.index} className="prose prose-sm dark:prose-invert max-w-none">
                      <StreamingMarkdownContent text={block.text} isStreaming={item.index === lastTextIdx} />
                    </div>
                  )
                }
                const isBlockStreaming = !!(isStreaming && item.index === lastTextIdx)
                const lastTxtSeg = textSegments.reduce((acc: number, s, j) => (s.type === 'text' ? j : acc), -1)
                return (
                  <div key={item.index}>
                    {textSegments.map((seg, j) => {
                      if (seg.type === 'think') {
                        return <ThinkingBlock key={j} thinking={seg.content} isStreaming={isBlockStreaming && !seg.closed} />
                      }
                      return (
                        <div key={j} className="prose prose-sm dark:prose-invert max-w-none">
                          <StreamingMarkdownContent text={seg.content} isStreaming={isBlockStreaming && j === lastTxtSeg} />
                        </div>
                      )
                    })}
                  </div>
                )
              }
              case 'tool_use':
                return renderToolBlock(block, block.id)
              default:
                return null
            }
          }

          // kind === 'group': render grouped tool calls
          if (toolsCollapsed) return null
          const groupBlocks = item.indices.map((idx) => content[idx] as Extract<ContentBlock, { type: 'tool_use' }>)
          const groupKey = `group-${item.indices[0]}`

          // Single item in group — render directly without wrapper
          if (groupBlocks.length === 1) {
            const block = groupBlocks[0]
            const result = toolResults?.get(block.id)
            const liveTc = liveToolCallMap?.get(block.id)
            return (
              <ToolCallCard
                key={block.id}
                name={block.name}
                input={block.input}
                output={liveTc?.output ?? result?.content}
                status={liveTc?.status ?? (result?.isError ? 'error' : 'completed')}
                error={liveTc?.error}
                startedAt={liveTc?.startedAt}
                completedAt={liveTc?.completedAt}
              />
            )
          }

          // Multiple items — wrap in ToolCallGroup
          const groupItems = groupBlocks.map((block) => {
            const result = toolResults?.get(block.id)
            const liveTc = liveToolCallMap?.get(block.id)
            return {
              id: block.id,
              name: block.name,
              input: block.input,
              output: liveTc?.output ?? result?.content,
              status: (liveTc?.status ?? (result?.isError ? 'error' : 'completed')) as import('@renderer/lib/agent/types').ToolCallStatus | 'completed',
              error: liveTc?.error,
              startedAt: liveTc?.startedAt,
              completedAt: liveTc?.completedAt,
            }
          })

          return (
            <ToolCallGroup key={groupKey} toolName={item.toolName} items={groupItems}>
              {groupBlocks.map((block) => {
                const result = toolResults?.get(block.id)
                const liveTc = liveToolCallMap?.get(block.id)
                return (
                  <ToolCallCard
                    key={block.id}
                    name={block.name}
                    input={block.input}
                    output={liveTc?.output ?? result?.content}
                    status={liveTc?.status ?? (result?.isError ? 'error' : 'completed')}
                    error={liveTc?.error}
                    startedAt={liveTc?.startedAt}
                    completedAt={liveTc?.completedAt}
                  />
                )
              })}
            </ToolCallGroup>
          )
        })}
        {isStreaming && <span className="inline-block w-1.5 h-4 bg-foreground/70 animate-pulse" />}
      </div>
    )
  }

  const plainText = typeof content === 'string'
    ? stripThinkTags(content)
    : content.filter((b) => b.type === 'text').map((b) => stripThinkTags(b.text)).join('\n')

  const activeProvider = useProviderStore((s) => {
    const pid = s.activeProviderId
    return pid ? s.providers.find((p) => p.id === pid) ?? null : null
  })
  const activeModelId = useProviderStore((s) => s.activeModelId)
  const activeModelCfg = activeProvider?.models.find((m) => m.id === activeModelId)
  const modelDisplayName = activeModelCfg?.name || activeModelId?.split('/').pop()?.replace(/-\d{8}$/, '') || 'Assistant'

  return (
    <div className="group/msg flex gap-3">
      <Avatar className="size-7 shrink-0 ring-1 ring-border/50">
        <AvatarFallback className="bg-gradient-to-br from-secondary to-muted text-secondary-foreground text-xs">
          <ModelIcon icon={activeModelCfg?.icon} modelId={activeModelId} providerBuiltinId={activeProvider?.builtinId} size={16} />
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 pt-0.5 overflow-hidden">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-medium">{modelDisplayName}</p>
          {!isStreaming && plainText && (
            <span className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-0.5">
              <CopyButton text={plainText} />
              {devMode && debugInfo && <DebugToggleButton debugInfo={debugInfo} />}
            </span>
          )}
        </div>
        {renderContent()}
        {!isStreaming && plainText && (
          <p className="mt-1 text-[10px] text-muted-foreground/40 tabular-nums">
            {usage ? (() => {
              const total = usage.inputTokens + usage.outputTokens
              const modelCfg = useProviderStore.getState().getActiveModelConfig()
              const cost = calculateCost(usage, modelCfg)
              return (
                <>
                  {`${formatTokens(total)} tokens (${formatTokens(usage.inputTokens)}↓ ${formatTokens(usage.outputTokens)}↑`}
                  {usage.cacheReadTokens ? ` · ${formatTokens(usage.cacheReadTokens)} cached` : ''}
                  {usage.reasoningTokens ? ` · ${formatTokens(usage.reasoningTokens)} reasoning` : ''}
                  {')' }
                  {cost !== null && <span className="text-emerald-500/70"> · {formatCost(cost)}</span>}
                </>
              )
            })() : `~${formatTokens(fallbackTokens)} tokens`}
          </p>
        )}
      </div>
    </div>
  )
}
