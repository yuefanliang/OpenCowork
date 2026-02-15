import * as React from 'react'
import { useState, useCallback } from 'react'
import { MessageCircleQuestion, Check, ChevronRight } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { resolveAskUserAnswers } from '@renderer/lib/tools/ask-user-tool'
import type { AskUserQuestionItem, AskUserAnswers } from '@renderer/lib/tools/ask-user-tool'
import type { ToolCallStatus } from '@renderer/lib/agent/types'
import type { ToolResultContent } from '@renderer/lib/api/types'

interface AskUserQuestionCardProps {
  toolUseId: string
  input: Record<string, unknown>
  output?: ToolResultContent
  status: ToolCallStatus | 'completed'
  isLive: boolean
}

function QuestionBlock({
  index,
  item,
  selected,
  customText,
  onToggle,
  onCustomTextChange,
  disabled,
}: {
  index: number
  item: AskUserQuestionItem
  selected: Set<string>
  customText: string
  onToggle: (index: number, value: string) => void
  onCustomTextChange: (index: number, text: string) => void
  disabled: boolean
}): React.JSX.Element {
  const isOtherSelected = selected.has('__other__')

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{item.question}</p>
      {item.options && item.options.length > 0 && (
        <div className="space-y-1.5">
          {item.options.map((opt, oi) => {
            const value = opt.label
            const isSelected = selected.has(value)
            return (
              <button
                key={oi}
                disabled={disabled}
                onClick={() => onToggle(index, value)}
                className={cn(
                  'flex items-start gap-2.5 w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  isSelected
                    ? 'border-primary/50 bg-primary/5 text-foreground'
                    : 'border-border/50 bg-muted/5 text-muted-foreground hover:border-border hover:bg-muted/10',
                  disabled && 'opacity-60 cursor-not-allowed'
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
                    item.multiSelect ? 'rounded-sm' : 'rounded-full',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground/30'
                  )}
                >
                  {isSelected && <Check className="size-3" />}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{opt.label}</span>
                  {opt.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground/70">{opt.description}</p>
                  )}
                </div>
              </button>
            )
          })}
          {/* "Other" option — always available */}
          <button
            disabled={disabled}
            onClick={() => onToggle(index, '__other__')}
            className={cn(
              'flex items-start gap-2.5 w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors',
              isOtherSelected
                ? 'border-primary/50 bg-primary/5 text-foreground'
                : 'border-border/50 bg-muted/5 text-muted-foreground hover:border-border hover:bg-muted/10',
              disabled && 'opacity-60 cursor-not-allowed'
            )}
          >
            <span
              className={cn(
                'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
                item.multiSelect ? 'rounded-sm' : 'rounded-full',
                isOtherSelected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-muted-foreground/30'
              )}
            >
              {isOtherSelected && <Check className="size-3" />}
            </span>
            <span className="font-medium">Other</span>
          </button>
        </div>
      )}
      {/* Text input: shown when no options or "Other" is selected */}
      {(!item.options || item.options.length === 0 || isOtherSelected) && (
        <textarea
          disabled={disabled}
          value={customText}
          onChange={(e) => onCustomTextChange(index, e.target.value)}
          placeholder="Type your answer..."
          rows={2}
          className={cn(
            'w-full rounded-lg border border-border/50 bg-muted/5 px-3 py-2 text-sm',
            'placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:ring-1 focus:ring-primary/30',
            disabled && 'opacity-60 cursor-not-allowed'
          )}
        />
      )}
    </div>
  )
}

/** Parse output string to extract answered questions for display */
function parseAnsweredOutput(output: ToolResultContent | undefined): string | null {
  if (!output) return null
  const text = typeof output === 'string' ? output : output
    .filter((b) => b.type === 'text')
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('\n')
  if (!text || text.startsWith('{')) return null // JSON error
  return text
}

export function AskUserQuestionCard({
  toolUseId,
  input,
  output,
  status,
  isLive,
}: AskUserQuestionCardProps): React.JSX.Element {
  const questions = (input.questions as AskUserQuestionItem[]) ?? []
  const isAnswered = status === 'completed' && !!output
  const isPending = !isAnswered && (status === 'running' || isLive)

  // Per-question selection state
  const [selections, setSelections] = useState<Map<number, Set<string>>>(() => new Map())
  const [customTexts, setCustomTexts] = useState<Map<number, string>>(() => new Map())

  const handleToggle = useCallback(
    (qIdx: number, value: string) => {
      setSelections((prev) => {
        const next = new Map(prev)
        const current = new Set(next.get(qIdx) ?? [])
        const q = questions[qIdx]
        if (value === '__other__') {
          if (current.has('__other__')) {
            current.delete('__other__')
          } else {
            if (!q?.multiSelect) current.clear()
            current.add('__other__')
          }
        } else {
          if (current.has(value)) {
            current.delete(value)
          } else {
            if (!q?.multiSelect) {
              current.clear()
            }
            current.add(value)
          }
          // Deselect "Other" when a regular option is picked in single-select
          if (!q?.multiSelect) current.delete('__other__')
        }
        next.set(qIdx, current)
        return next
      })
    },
    [questions]
  )

  const handleCustomTextChange = useCallback((qIdx: number, text: string) => {
    setCustomTexts((prev) => {
      const next = new Map(prev)
      next.set(qIdx, text)
      return next
    })
  }, [])

  const handleSubmit = useCallback(() => {
    const answers: AskUserAnswers = {}
    for (let i = 0; i < questions.length; i++) {
      const sel = selections.get(i) ?? new Set()
      const custom = customTexts.get(i) ?? ''
      const q = questions[i]

      // Collect selected option labels (excluding __other__)
      const picked = [...sel].filter((v) => v !== '__other__')

      // If "Other" is selected or no options exist, use custom text
      if (sel.has('__other__') || (!q.options || q.options.length === 0)) {
        if (custom.trim()) {
          if (q.multiSelect) {
            answers[String(i)] = [...picked, custom.trim()]
          } else {
            answers[String(i)] = custom.trim()
          }
        } else if (picked.length > 0) {
          answers[String(i)] = q.multiSelect ? picked : picked[0]
        }
      } else if (picked.length > 0) {
        answers[String(i)] = q.multiSelect ? picked : picked[0]
      }
    }
    resolveAskUserAnswers(toolUseId, answers)
  }, [toolUseId, questions, selections, customTexts])

  // Check if at least one question has an answer
  const hasAnyAnswer = React.useMemo(() => {
    for (let i = 0; i < questions.length; i++) {
      const sel = selections.get(i) ?? new Set()
      const custom = customTexts.get(i) ?? ''
      const q = questions[i]
      if (sel.size > 0 && !sel.has('__other__')) return true
      if (sel.has('__other__') && custom.trim()) return true
      if ((!q.options || q.options.length === 0) && custom.trim()) return true
    }
    return false
  }, [questions, selections, customTexts])

  // Already answered — show summary
  if (isAnswered) {
    const answeredText = parseAnsweredOutput(output)
    return (
      <div className="my-3 rounded-xl border border-green-500/20 bg-green-500/5 p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-green-500">
          <Check className="size-4" />
          <span>Questions answered</span>
        </div>
        {answeredText && (
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{answeredText}</pre>
        )}
      </div>
    )
  }

  return (
    <div className="my-3 rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageCircleQuestion className="size-5 text-primary" />
        <span className="text-sm font-semibold">Agent needs your input</span>
        {isPending && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-primary/60">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            Waiting for your response
          </span>
        )}
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((q, i) => (
          <QuestionBlock
            key={i}
            index={i}
            item={q}
            selected={selections.get(i) ?? new Set()}
            customText={customTexts.get(i) ?? ''}
            onToggle={handleToggle}
            onCustomTextChange={handleCustomTextChange}
            disabled={!isPending}
          />
        ))}
      </div>

      {/* Submit button */}
      {isPending && (
        <button
          onClick={handleSubmit}
          disabled={!hasAnyAnswer}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            hasAnyAnswer
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          Submit
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  )
}
