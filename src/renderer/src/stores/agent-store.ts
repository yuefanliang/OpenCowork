import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { ToolCallState } from '../lib/agent/types'

// Approval resolvers live outside the store — they hold non-serializable
// callbacks and don't need to trigger React re-renders.
const approvalResolvers = new Map<string, (approved: boolean) => void>()

interface AgentStore {
  isRunning: boolean
  currentLoopId: string | null
  pendingToolCalls: ToolCallState[]
  executedToolCalls: ToolCallState[]

  setRunning: (running: boolean) => void
  setCurrentLoopId: (id: string | null) => void
  addToolCall: (tc: ToolCallState) => void
  updateToolCall: (id: string, patch: Partial<ToolCallState>) => void
  clearToolCalls: () => void
  abort: () => void

  // Approval flow
  requestApproval: (toolCallId: string) => Promise<boolean>
  resolveApproval: (toolCallId: string, approved: boolean) => void
}

export const useAgentStore = create<AgentStore>()(
  immer((set) => ({
    isRunning: false,
    currentLoopId: null,
    pendingToolCalls: [],
    executedToolCalls: [],

    setRunning: (running) => set({ isRunning: running }),

    setCurrentLoopId: (id) => set({ currentLoopId: id }),

    addToolCall: (tc) => {
      set((state) => {
        if (tc.status === 'pending_approval') {
          state.pendingToolCalls.push(tc)
        } else {
          state.executedToolCalls.push(tc)
        }
      })
    },

    updateToolCall: (id, patch) => {
      set((state) => {
        const pending = state.pendingToolCalls.find((t) => t.id === id)
        if (pending) {
          Object.assign(pending, patch)
          if (patch.status && patch.status !== 'pending_approval') {
            const idx = state.pendingToolCalls.findIndex((t) => t.id === id)
            if (idx !== -1) {
              const [moved] = state.pendingToolCalls.splice(idx, 1)
              state.executedToolCalls.push(moved)
            }
          }
          return
        }
        const executed = state.executedToolCalls.find((t) => t.id === id)
        if (executed) Object.assign(executed, patch)
      })
    },

    clearToolCalls: () =>
      set({ pendingToolCalls: [], executedToolCalls: [] }),

    abort: () => {
      set({ isRunning: false, currentLoopId: null })
      for (const [, resolve] of approvalResolvers) {
        resolve(false)
      }
      approvalResolvers.clear()
    },

    requestApproval: (toolCallId) => {
      return new Promise<boolean>((resolve) => {
        approvalResolvers.set(toolCallId, resolve)
      })
    },

    resolveApproval: (toolCallId, approved) => {
      const resolve = approvalResolvers.get(toolCallId)
      if (resolve) {
        resolve(approved)
        approvalResolvers.delete(toolCallId)
      }
    },
  }))
)
