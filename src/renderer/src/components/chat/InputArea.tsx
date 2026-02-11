import * as React from 'react'
import { useState as useLocalState } from 'react'
import { Send, Square, FolderOpen, AlertTriangle, FileUp, Sparkles, X, Trash2, ImagePlus, Brain } from 'lucide-react'
import { nanoid } from 'nanoid'
import { Button } from '@renderer/components/ui/button'
import { Textarea } from '@renderer/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useProviderStore } from '@renderer/stores/provider-store'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { useUIStore, type AppMode } from '@renderer/stores/ui-store'
import { formatTokens } from '@renderer/lib/format-tokens'
import { useDebouncedTokens } from '@renderer/hooks/use-estimated-tokens'
import { useChatStore } from '@renderer/stores/chat-store'
import { SkillsMenu } from './SkillsMenu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@renderer/components/ui/alert-dialog'

const placeholders: Record<AppMode, string> = {
  chat: 'Type a message...',
  cowork: 'Ask the assistant to help with your project...',
  code: 'Describe what you want to build...',
}

export interface ImageAttachment {
  id: string
  dataUrl: string
  mediaType: string
}

const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
const MAX_IMAGE_SIZE = 20 * 1024 * 1024 // 20 MB

function fileToImageAttachment(file: File): Promise<ImageAttachment | null> {
  return new Promise((resolve) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) { resolve(null); return }
    if (file.size > MAX_IMAGE_SIZE) { resolve(null); return }
    const reader = new FileReader()
    reader.onload = () => {
      resolve({ id: nanoid(), dataUrl: reader.result as string, mediaType: file.type })
    }
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

interface InputAreaProps {
  onSend: (text: string, images?: ImageAttachment[]) => void
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
  const debouncedTokens = useDebouncedTokens(text)
  const [selectedSkill, setSelectedSkill] = React.useState<string | null>(null)
  const [attachedImages, setAttachedImages] = React.useState<ImageAttachment[]>([])
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const activeProvider = useProviderStore((s) => {
    const { providers, activeProviderId } = s
    if (!activeProviderId) return null
    return providers.find((p) => p.id === activeProviderId) ?? null
  })
  const activeModelId = useProviderStore((s) => s.activeModelId)
  const supportsVision = React.useMemo(() => {
    if (!activeProvider) return false
    const model = activeProvider.models.find((m) => m.id === activeModelId)
    return model?.supportsVision ?? false
  }, [activeProvider, activeModelId])
  const supportsThinking = React.useMemo(() => {
    if (!activeProvider) return false
    const model = activeProvider.models.find((m) => m.id === activeModelId)
    return model?.supportsThinking ?? false
  }, [activeProvider, activeModelId])
  const thinkingEnabled = useSettingsStore((s) => s.thinkingEnabled)
  const toggleThinking = React.useCallback(() => {
    useSettingsStore.getState().updateSettings({ thinkingEnabled: !useSettingsStore.getState().thinkingEnabled })
  }, [])
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const mode = useUIStore((s) => s.mode)
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const hasMessages = useChatStore((s) => {
    const session = s.sessions.find((sess) => sess.id === s.activeSessionId)
    return (session?.messages.length ?? 0) > 0
  })
  const clearSessionMessages = useChatStore((s) => s.clearSessionMessages)
  const hasApiKey = !!(activeProvider?.apiKey)

  // Auto-focus textarea when not streaming or when switching sessions
  React.useEffect(() => {
    if (!isStreaming && !disabled) {
      textareaRef.current?.focus()
    }
  }, [isStreaming, disabled, activeSessionId])

  // Consume pendingInsertText from FileTree clicks
  const pendingInsert = useUIStore((s) => s.pendingInsertText)
  React.useEffect(() => {
    if (pendingInsert) {
      setText((prev) => {
        const prefix = prev && !prev.endsWith(' ') && !prev.endsWith('\n') ? ' ' : ''
        return `${prev}${prefix}${pendingInsert}`
      })
      useUIStore.getState().setPendingInsertText(null)
      textareaRef.current?.focus()
    }
  }, [pendingInsert])

  // --- Image helpers ---
  const addImages = React.useCallback(async (files: File[]) => {
    const results = await Promise.all(files.map(fileToImageAttachment))
    const valid = results.filter(Boolean) as ImageAttachment[]
    if (valid.length > 0) setAttachedImages((prev) => [...prev, ...valid])
  }, [])

  const removeImage = React.useCallback((id: string) => {
    setAttachedImages((prev) => prev.filter((img) => img.id !== id))
  }, [])

  const handleSend = (): void => {
    const trimmed = text.trim()
    if (!trimmed && attachedImages.length === 0) return
    if (disabled) return
    const message = selectedSkill
      ? `[Skill: ${selectedSkill}]\n${trimmed}`
      : trimmed
    onSend(message, attachedImages.length > 0 ? attachedImages : undefined)
    setText('')
    setAttachedImages([])
    setSelectedSkill(null)
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
    // Ctrl+Enter also sends
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
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

  // Paste handler for images
  const handlePaste = React.useCallback((e: React.ClipboardEvent): void => {
    if (!supportsVision) return
    const items = Array.from(e.clipboardData.items)
    const imageFiles = items
      .filter((item) => item.kind === 'file' && ACCEPTED_IMAGE_TYPES.includes(item.type))
      .map((item) => item.getAsFile())
      .filter(Boolean) as File[]
    if (imageFiles.length > 0) {
      e.preventDefault()
      addImages(imageFiles)
    }
  }, [supportsVision, addImages])

  // Drag-and-drop: images go to attachments, other files insert paths
  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>): void => {
    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
      e.preventDefault()
      const fileArr = Array.from(files)
      const imageFiles = supportsVision
        ? fileArr.filter((f) => ACCEPTED_IMAGE_TYPES.includes(f.type))
        : []
      const otherFiles = supportsVision
        ? fileArr.filter((f) => !ACCEPTED_IMAGE_TYPES.includes(f.type))
        : fileArr
      if (imageFiles.length > 0) addImages(imageFiles)
      if (otherFiles.length > 0) {
        const paths = otherFiles.map((f) => (f as File & { path: string }).path).filter(Boolean)
        if (paths.length > 0) {
          const insertion = paths.join('\n')
          setText((prev) => prev ? `${prev}\n${insertion}` : insertion)
        }
      }
    }
  }

  const [dragging, setDragging] = useLocalState(false)

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = (): void => {
    setDragging(false)
  }

  const handleDropWrapped = (e: React.DragEvent<HTMLDivElement>): void => {
    setDragging(false)
    handleDrop(e as unknown as React.DragEvent<HTMLTextAreaElement>)
  }

  return (
    <div className="px-4 py-3 pb-4">
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

      <div className="mx-auto max-w-3xl">
        <div className={`relative rounded-2xl border bg-background shadow-lg transition-shadow focus-within:shadow-xl focus-within:ring-1 focus-within:ring-ring/20 ${dragging ? 'ring-2 ring-primary/50' : ''}`}>
          {/* Skill tag */}
          {selectedSkill && (
            <div className="px-3 pt-3 pb-0">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 text-xs font-medium text-violet-600 dark:text-violet-400">
                <Sparkles className="size-3" />
                {selectedSkill}
                <button
                  type="button"
                  className="ml-0.5 rounded-sm p-0.5 hover:bg-violet-500/20 transition-colors"
                  onClick={() => setSelectedSkill(null)}
                >
                  <X className="size-3" />
                </button>
              </span>
            </div>
          )}

          {/* Image preview strip */}
          {attachedImages.length > 0 && (
            <div className="flex gap-2 px-3 pt-3 pb-1 overflow-x-auto">
              {attachedImages.map((img) => (
                <div key={img.id} className="relative group/img shrink-0">
                  <img
                    src={img.dataUrl}
                    alt=""
                    className="size-16 rounded-lg object-cover border border-border/60 shadow-sm"
                  />
                  <button
                    type="button"
                    className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity shadow"
                    onClick={() => removeImage(img.id)}
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Text input area */}
          <div
            className={`relative px-3 ${selectedSkill || attachedImages.length > 0 ? 'pt-1.5' : 'pt-3'}`}
            onDrop={handleDropWrapped}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {dragging && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-primary/5 pointer-events-none">
                <span className="flex items-center gap-1.5 text-xs text-primary/70 font-medium">
                  <FileUp className="size-3.5" />
                  {supportsVision ? 'Drop images or files' : 'Drop files to insert paths'}
                </span>
              </div>
            )}
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={placeholders[mode] ?? 'Type a message...'}
              className="min-h-[60px] max-h-[300px] w-full resize-none border-0 bg-background dark:bg-background p-1 shadow-none focus-visible:ring-0 text-base md:text-sm"
              rows={1}
              disabled={disabled}
            />
          </div>

          {/* Hidden file input for image upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addImages(Array.from(e.target.files))
              e.target.value = ''
            }}
          />

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between px-2 pb-2 mt-1">
            {/* Left tools */}
            <div className="flex items-center gap-1">
              {/* Skills menu (+ button) */}
              {mode !== 'chat' && (
                <SkillsMenu
                  onSelectSkill={(name) => {
                    setSelectedSkill(name)
                    textareaRef.current?.focus()
                  }}
                  disabled={disabled || isStreaming}
                />
              )}

              {/* Image upload button */}
              {supportsVision && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={disabled || isStreaming}
                    >
                      <ImagePlus className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Attach images (paste or drag & drop also supported)</TooltipContent>
                </Tooltip>
              )}

              {/* Think toggle button */}
              {supportsThinking && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`size-8 rounded-lg transition-colors ${
                        thinkingEnabled
                          ? 'text-violet-600 dark:text-violet-400 bg-violet-500/10 hover:bg-violet-500/20'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={toggleThinking}
                      disabled={disabled || isStreaming}
                    >
                      <Brain className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{thinkingEnabled ? '关闭深度思考' : '启用深度思考'}</TooltipContent>
                </Tooltip>
              )}

              {/* Attachment / Folder button */}
              {onSelectFolder && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
                      onClick={onSelectFolder}
                    >
                      <FolderOpen className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Select working folder</TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              {debouncedTokens > 0 && (
                <span className="text-[10px] text-muted-foreground/60 select-none tabular-nums">
                  {formatTokens(debouncedTokens)} tokens
                </span>
              )}

              {/* Clear messages */}
              {hasMessages && !isStreaming && (
                <AlertDialog>
                  <Tooltip>
                    <AlertDialogTrigger asChild>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-lg text-muted-foreground/40 hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                    </AlertDialogTrigger>
                    <TooltipContent>Clear conversation</TooltipContent>
                  </Tooltip>
                  <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear all messages?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove all messages in this conversation. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel size="sm">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        size="sm"
                        onClick={() => activeSessionId && clearSessionMessages(activeSessionId)}
                      >
                        Clear
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {/* Send / Stop button */}
              {isStreaming ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 rounded-lg px-3"
                      onClick={onStop}
                    >
                      <Square className="size-3.5 mr-1.5" />
                      Stop
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Stop (Esc)</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      className="h-8 rounded-lg px-3 bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
                      onClick={handleSend}
                      disabled={(!text.trim() && attachedImages.length === 0) || disabled}
                    >
                      <span>Start</span>
                      <Send className="size-3.5 ml-1.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Send (Enter)</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
