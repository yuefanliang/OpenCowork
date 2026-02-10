import { create } from 'zustand'

export interface TodoItem {
  id: string
  content: string
  activeForm?: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'high' | 'medium' | 'low'
  createdAt: number
  updatedAt: number
}

interface TaskStore {
  todos: TodoItem[]

  setTodos: (todos: TodoItem[]) => void
  getTodos: () => TodoItem[]
  getActiveTodo: () => TodoItem | undefined
  getProgress: () => { total: number; completed: number; percentage: number }
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  todos: [],

  setTodos: (todos) => {
    const now = Date.now()
    set({
      todos: todos.map((t) => ({
        ...t,
        createdAt: t.createdAt ?? now,
        updatedAt: now,
      })),
    })
  },

  getTodos: () => get().todos,

  getActiveTodo: () => get().todos.find((t) => t.status === 'in_progress'),

  getProgress: () => {
    const { todos } = get()
    const total = todos.length
    const completed = todos.filter((t) => t.status === 'completed').length
    return {
      total,
      completed,
      percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
    }
  },
}))
