import { toolRegistry } from '../agent/tool-registry'
import { useTaskStore } from '../../stores/task-store'
import type { ToolHandler } from './tool-types'

const todoReadHandler: ToolHandler = {
  definition: {
    name: 'TodoRead',
    description: 'Read the current to-do list for the session',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  execute: async () => {
    const todos = useTaskStore.getState().getTodos()
    return JSON.stringify({ todos })
  },
}

const todoWriteHandler: ToolHandler = {
  definition: {
    name: 'TodoWrite',
    description: 'Create and manage a structured task list',
    inputSchema: {
      type: 'object',
      properties: {
        todos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              content: { type: 'string' },
              status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
              priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            },
            required: ['id', 'content', 'status', 'priority'],
          },
        },
      },
      required: ['todos'],
    },
  },
  execute: async (input) => {
    const todos = input.todos as Array<{
      id: string
      content: string
      status: 'pending' | 'in_progress' | 'completed'
      priority: 'high' | 'medium' | 'low'
    }>
    const now = Date.now()
    useTaskStore.getState().setTodos(
      todos.map((t) => ({
        ...t,
        createdAt: now,
        updatedAt: now,
      }))
    )
    return JSON.stringify({ success: true, count: todos.length })
  },
}

export function registerTodoTools(): void {
  toolRegistry.register(todoReadHandler)
  toolRegistry.register(todoWriteHandler)
}
