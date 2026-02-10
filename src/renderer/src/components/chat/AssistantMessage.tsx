import { useState, useCallback } from 'react'
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
import { Bot, Copy, Check } from 'lucide-react'
import type { ContentBlock } from '@renderer/lib/api/types'
import { ToolCallCard } from './ToolCallCard'

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
    <div className="group relative rounded-md border border-border overflow-hidden my-3">
      <div className="flex items-center justify-between bg-muted/50 px-3 py-1 border-b border-border">
        <span className="text-[10px] font-mono text-muted-foreground">{language || 'text'}</span>
        <CopyButton text={code} />
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{ margin: 0, padding: '12px', fontSize: '12px', background: 'transparent' }}
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
        pre: ({ children }) => <>{children}</>,
        code: ({ children, className, ...props }) => {
          const match = /language-(\w+)/.exec(className || '')
          const isInline = !match && !className
          if (isInline) {
            return (
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono" {...props}>
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

export function AssistantMessage({ content, isStreaming }: AssistantMessageProps): React.JSX.Element {
  const renderContent = (): React.JSX.Element => {
    if (typeof content === 'string') {
      return (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <MarkdownContent text={content} />
          {isStreaming && <span className="inline-block w-1.5 h-4 bg-foreground/70 animate-pulse ml-0.5" />}
        </div>
      )
    }

    return (
      <div className="space-y-2">
        {content.map((block, i) => {
          switch (block.type) {
            case 'text':
              return (
                <div key={i} className="prose prose-sm dark:prose-invert max-w-none">
                  <MarkdownContent text={block.text} />
                </div>
              )
            case 'tool_use':
              return (
                <ToolCallCard
                  key={block.id}
                  name={block.name}
                  input={block.input}
                  status="completed"
                />
              )
            default:
              return null
          }
        })}
        {isStreaming && <span className="inline-block w-1.5 h-4 bg-foreground/70 animate-pulse" />}
      </div>
    )
  }

  const plainText = typeof content === 'string'
    ? content
    : content.filter((b) => b.type === 'text').map((b) => b.text).join('\n')

  return (
    <div className="group/msg flex gap-3">
      <Avatar className="size-7 shrink-0">
        <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
          <Bot className="size-3.5" />
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-medium">Assistant</p>
          {!isStreaming && plainText && (
            <span className="opacity-0 group-hover/msg:opacity-100 transition-opacity">
              <CopyButton text={plainText} />
            </span>
          )}
        </div>
        {renderContent()}
      </div>
    </div>
  )
}
