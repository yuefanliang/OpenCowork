import { toolRegistry } from '../agent/tool-registry'
import { IPC } from '../ipc/channels'
import type { ToolHandler } from './tool-types'

const readHandler: ToolHandler = {
  definition: {
    name: 'Read',
    description: 'Read a file from the filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Absolute path to the file' },
        offset: { type: 'number', description: 'Start line (1-indexed)' },
        limit: { type: 'number', description: 'Number of lines to read' },
      },
      required: ['file_path'],
    },
  },
  execute: async (input, ctx) => {
    const result = await ctx.ipc.invoke(IPC.FS_READ_FILE, {
      path: input.file_path,
      offset: input.offset,
      limit: input.limit,
    })
    // IPC returns { type: 'image', mediaType, data } for image files
    if (result && typeof result === 'object' && (result as Record<string, unknown>).type === 'image') {
      const img = result as { mediaType: string; data: string }
      return [
        {
          type: 'image' as const,
          source: { type: 'base64' as const, mediaType: img.mediaType, data: img.data },
        },
      ]
    }
    return String(result)
  },
  requiresApproval: () => false,
}

const writeHandler: ToolHandler = {
  definition: {
    name: 'Write',
    description: 'Write content to a file',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Absolute path to the file' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['file_path', 'content'],
    },
  },
  execute: async (input, ctx) => {
    if (typeof input.file_path !== 'string' || input.file_path.trim().length === 0) {
      throw new Error('Write requires a non-empty "file_path" string')
    }
    if (typeof input.content !== 'string') {
      throw new Error('Write requires a "content" string')
    }

    const result = await ctx.ipc.invoke(IPC.FS_WRITE_FILE, {
      path: input.file_path,
      content: input.content,
    })
    if (isErrorResult(result)) {
      throw new Error(`Write failed: ${result.error}`)
    }

    return JSON.stringify({ success: true, path: input.file_path })
  },
  requiresApproval: (input, ctx) => {
    // Writing outside working folder requires approval
    const filePath = String(input.file_path)
    if (!ctx.workingFolder) return true
    return !filePath.startsWith(ctx.workingFolder)
  },
}

const editHandler: ToolHandler = {
  definition: {
    name: 'Edit',
    description: 'Perform exact string replacement in a file',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string' },
        old_string: { type: 'string' },
        new_string: { type: 'string' },
        replace_all: { type: 'boolean', description: 'Replace all occurrences (default false)' },
      },
      required: ['file_path', 'old_string', 'new_string'],
    },
  },
  execute: async (input, ctx) => {
    // Read file, perform replacement, write back
    const content = String(
      await ctx.ipc.invoke(IPC.FS_READ_FILE, { path: input.file_path })
    )
    const oldStr = String(input.old_string)
    const newStr = String(input.new_string)
    const replaceAll = Boolean(input.replace_all)

    let updated: string
    if (replaceAll) {
      updated = content.split(oldStr).join(newStr)
    } else {
      const idx = content.indexOf(oldStr)
      if (idx === -1) {
        return JSON.stringify({ error: 'old_string not found in file' })
      }
      updated = content.slice(0, idx) + newStr + content.slice(idx + oldStr.length)
    }

    await ctx.ipc.invoke(IPC.FS_WRITE_FILE, { path: input.file_path, content: updated })
    return JSON.stringify({ success: true })
  },
  requiresApproval: (input, ctx) => {
    const filePath = String(input.file_path)
    if (!ctx.workingFolder) return true
    return !filePath.startsWith(ctx.workingFolder)
  },
}

const lsHandler: ToolHandler = {
  definition: {
    name: 'LS',
    description: 'List files and directories in a given path',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the directory' },
        ignore: {
          type: 'array',
          items: { type: 'string' },
          description: 'Glob patterns to ignore',
        },
      },
      required: ['path'],
    },
  },
  execute: async (input, ctx) => {
    const result = await ctx.ipc.invoke(IPC.FS_LIST_DIR, {
      path: input.path,
      ignore: input.ignore,
    })
    return JSON.stringify(result)
  },
  requiresApproval: () => false,
}

export function registerFsTools(): void {
  toolRegistry.register(readHandler)
  toolRegistry.register(writeHandler)
  toolRegistry.register(editHandler)
  toolRegistry.register(lsHandler)
}

function isErrorResult(value: unknown): value is { error: string } {
  if (!value || typeof value !== 'object') return false
  const error = (value as { error?: unknown }).error
  return typeof error === 'string' && error.length > 0
}
