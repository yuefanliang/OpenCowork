// IPC Channel Constants

export const IPC = {
  // API Streaming
  API_STREAM_REQUEST: 'api:stream-request',
  API_STREAM_CHUNK: 'api:stream-chunk',
  API_STREAM_END: 'api:stream-end',
  API_STREAM_ERROR: 'api:stream-error',
  API_ABORT: 'api:abort',

  // File System
  FS_READ_FILE: 'fs:read-file',
  FS_WRITE_FILE: 'fs:write-file',
  FS_LIST_DIR: 'fs:list-dir',
  FS_MKDIR: 'fs:mkdir',
  FS_DELETE: 'fs:delete',
  FS_MOVE: 'fs:move',
  FS_SELECT_FOLDER: 'fs:select-folder',
  FS_GLOB: 'fs:glob',
  FS_GREP: 'fs:grep',

  // File Watching
  FS_WATCH_FILE: 'fs:watch-file',
  FS_UNWATCH_FILE: 'fs:unwatch-file',
  FS_FILE_CHANGED: 'fs:file-changed',

  // Shell
  SHELL_EXEC: 'shell:exec',
  SHELL_ABORT: 'shell:abort',

  // Process Management
  PROCESS_SPAWN: 'process:spawn',
  PROCESS_KILL: 'process:kill',
  PROCESS_WRITE: 'process:write',
  PROCESS_STATUS: 'process:status',
  PROCESS_LIST: 'process:list',
  PROCESS_OUTPUT: 'process:output',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Plugins
  PLUGIN_LIST_PROVIDERS: 'plugin:list-providers',
  PLUGIN_LIST: 'plugin:list',
  PLUGIN_ADD: 'plugin:add',
  PLUGIN_UPDATE: 'plugin:update',
  PLUGIN_REMOVE: 'plugin:remove',
  PLUGIN_START: 'plugin:start',
  PLUGIN_STOP: 'plugin:stop',
  PLUGIN_STATUS: 'plugin:status',
  PLUGIN_EXEC: 'plugin:exec',
  PLUGIN_SESSIONS_LIST: 'plugin:sessions:list',
  PLUGIN_SESSIONS_MESSAGES: 'plugin:sessions:messages',
  PLUGIN_SESSIONS_CREATE: 'plugin:sessions:create',
  PLUGIN_INCOMING_MESSAGE: 'plugin:incoming-message',

  // MCP
  MCP_LIST: 'mcp:list',
  MCP_ADD: 'mcp:add',
  MCP_UPDATE: 'mcp:update',
  MCP_REMOVE: 'mcp:remove',
  MCP_CONNECT: 'mcp:connect',
  MCP_DISCONNECT: 'mcp:disconnect',
  MCP_STATUS: 'mcp:status',
  MCP_SERVER_INFO: 'mcp:server-info',
  MCP_ALL_SERVERS_INFO: 'mcp:all-servers-info',
  MCP_LIST_TOOLS: 'mcp:list-tools',
  MCP_CALL_TOOL: 'mcp:call-tool',
  MCP_LIST_RESOURCES: 'mcp:list-resources',
  MCP_READ_RESOURCE: 'mcp:read-resource',
  MCP_LIST_PROMPTS: 'mcp:list-prompts',
  MCP_GET_PROMPT: 'mcp:get-prompt',
  MCP_REFRESH_CAPABILITIES: 'mcp:refresh-capabilities',
} as const

export type IPCChannel = (typeof IPC)[keyof typeof IPC]
