import { toolRegistry } from './tool-registry'

/**
 * Build a system prompt for the agent loop that includes tool descriptions
 * and behavioral instructions based on the current mode.
 */
export function buildSystemPrompt(options: {
  mode: 'cowork' | 'code'
  workingFolder?: string
  userSystemPrompt?: string
}): string {
  const { mode, workingFolder, userSystemPrompt } = options

  const toolDefs = toolRegistry.getDefinitions()
  const toolList = toolDefs
    .map((t) => `- **${t.name}**: ${t.description}`)
    .join('\n')

  const parts: string[] = []

  // Core identity
  parts.push(
    `You are OpenCowork, an AI coding assistant running inside an Electron desktop application.`
  )

  // Mode-specific instructions
  if (mode === 'cowork') {
    parts.push(
      `You are in Cowork mode. You have access to the user's local filesystem and can execute shell commands.`,
      `Follow a Plan-Act-Observe loop: understand the request, plan your approach, use tools to act, then observe results before continuing.`,
      `Always read files before editing them. Use the Edit tool for precise changes — never rewrite entire files unless creating new ones.`,
      `When running shell commands, explain what you're doing and why.`
    )
  } else {
    parts.push(
      `You are in Code mode. Focus on writing clean, well-structured code.`,
      `You have access to the filesystem and can create or modify files.`
    )
  }

  // Working folder context
  if (workingFolder) {
    parts.push(`\nThe user's working folder is: ${workingFolder}`)
    parts.push(`All relative paths should be resolved against this folder.`)
  }

  // Available tools
  if (toolDefs.length > 0) {
    parts.push(`\n## Available Tools\n${toolList}`)
    parts.push(
      `Use tools when needed. Do not fabricate file contents — always read first.`,
      `Shell commands that modify the system require user approval.`
    )
  }

  // User's custom system prompt
  if (userSystemPrompt) {
    parts.push(`\n## Additional Instructions\n${userSystemPrompt}`)
  }

  return parts.join('\n')
}
