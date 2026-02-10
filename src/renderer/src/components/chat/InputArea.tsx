import * as React from 'react'
import { Send, Square, FolderOpen, AlertTriangle } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Textarea } from '@renderer/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { useUIStore } from '@renderer/stores/ui-store'

interface InputAreaProps {
  onSend: (text: string) => void
  onStop?: () => void
  onSelectFolder?: () => void
  isStreaming?: boolean
  workingFolder?: string
  disabled?: boolean
}

export function InputArea({
  onSend,
  onStop,
  onSelectFolder,
  isStreaming = false,
  workingFolder,
  disabled = false,
}: InputAreaProps): React.JSX.Element {
  const [text, setText] = React.useState('')
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const apiKey = useSettingsStore((s) => s.apiKey)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const hasApiKey = !!apiKey

  // Auto-focus textarea when not streaming
  React.useEffect(() => {
    if (!isStreaming && !disabled) {
      textareaRef.current?.focus()
    }
  }, [isStreaming, disabled])

  const handleSend = (): void => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isStreaming) return
      handleSend()
    }
  }

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setText(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  return (
    <div className="border-t bg-background p-4">
      {/* API key warning */}
      {!hasApiKey && (
        <button
          type="button"
          className="mb-2 flex w-full items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-left text-xs text-amber-600 dark:text-amber-400 transition-colors hover:bg-amber-500/10"
          onClick={() => setSettingsOpen(true)}
        >
          <AlertTriangle className="size-3.5 shrink-0" />
          <span>No API key configured. Click here to open Settings.</span>
        </button>
      )}

      {/* Working folder indicator */}
      {workingFolder && (
        <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <FolderOpen className="size-3" />
          <span className="truncate">{workingFolder}</span>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Attachment / Folder button */}
        <div className="flex gap-1">
          {onSelectFolder && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={onSelectFolder}
                >
                  <FolderOpen className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Select working folder</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Text input */}
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="min-h-[40px] max-h-[200px] resize-none"
          rows={1}
          disabled={disabled}
        />

        {/* Send / Stop button */}
        {isStreaming ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="icon"
                className="size-8 shrink-0"
                onClick={onStop}
              >
                <Square className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Stop</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                className="size-8 shrink-0"
                onClick={handleSend}
                disabled={!text.trim() || disabled}
              >
                <Send className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Send (Enter)</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
