import { registerTodoTools } from './todo-tool'
import { registerFsTools } from './fs-tool'
import { registerSearchTools } from './search-tool'
import { registerBashTools } from './bash-tool'

/**
 * Register all built-in tools with the global tool registry.
 * Call this once at app initialization.
 */
export function registerAllTools(): void {
  registerTodoTools()
  registerFsTools()
  registerSearchTools()
  registerBashTools()
}
