import type { ToolDefinition } from '../api/types'
import type { ToolHandler, ToolContext } from '../tools/tool-types'

/**
 * Tool Registry - manages tool handlers with a pluggable registration pattern.
 * New tools are added by calling register() without modifying core code.
 */
class ToolRegistry {
  private tools = new Map<string, ToolHandler>()

  register(handler: ToolHandler): void {
    this.tools.set(handler.definition.name, handler)
  }

  unregister(name: string): void {
    this.tools.delete(name)
  }

  get(name: string): ToolHandler | undefined {
    return this.tools.get(name)
  }

  has(name: string): boolean {
    return this.tools.has(name)
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition)
  }

  getNames(): string[] {
    return Array.from(this.tools.keys())
  }

  async execute(
    name: string,
    input: Record<string, unknown>,
    ctx: ToolContext
  ): Promise<string> {
    const handler = this.tools.get(name)
    if (!handler) {
      return JSON.stringify({ error: `Unknown tool: ${name}` })
    }
    try {
      return await handler.execute(input, ctx)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return JSON.stringify({ error: message })
    }
  }

  checkRequiresApproval(
    name: string,
    input: Record<string, unknown>,
    ctx: ToolContext
  ): boolean {
    const handler = this.tools.get(name)
    if (!handler) return true // Unknown tools always require approval
    return handler.requiresApproval?.(input, ctx) ?? false
  }
}

export const toolRegistry = new ToolRegistry()
