import { ipcMain, shell, BrowserWindow } from 'electron'
import { spawn } from 'child_process'

function sanitizeOutput(raw: string, maxLen: number): string {
  const trimmed = raw.slice(0, maxLen)
  // Detect binary / non-text output by sampling the first 256 chars
  const sample = trimmed.slice(0, 256)
  let bad = 0
  for (let i = 0; i < sample.length; i++) {
    const c = sample.charCodeAt(i)
    // non-printable control chars (except tab, LF, CR) or replacement char U+FFFD
    if ((c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) || c === 0xfffd) bad++
  }
  if (sample.length > 0 && bad / sample.length > 0.1) {
    return `[Binary or non-text output, ${raw.length} bytes — content omitted]`
  }
  return trimmed
}

export function registerShellHandlers(): void {
  ipcMain.handle(
    'shell:exec',
    async (_event, args: { command: string; timeout?: number; cwd?: string; execId?: string }) => {
      const timeout = Math.min(args.timeout ?? 120000, 600000)
      const execId = args.execId

      // On Windows, default cmd.exe code page (e.g. CP936) != UTF-8.
      // Prepend chcp 65001 to switch console to UTF-8 before running the command.
      const cmd =
        process.platform === 'win32'
          ? `chcp 65001 >nul & ${args.command}`
          : args.command

      return new Promise((resolve) => {
        let stdout = ''
        let stderr = ''
        let killed = false

        const child = spawn(cmd, {
          cwd: args.cwd || process.cwd(),
          shell: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
            // Force Python to use UTF-8 for stdin/stdout/stderr
            PYTHONIOENCODING: 'utf-8',
            PYTHONUTF8: '1',
          },
        })

        const sendChunk = (chunk: string): void => {
          if (!execId) return
          const win = BrowserWindow.getAllWindows()[0]
          if (win && !win.isDestroyed()) {
            win.webContents.send('shell:output', { execId, chunk })
          }
        }

        child.stdout?.on('data', (data: Buffer) => {
          const text = data.toString('utf8')
          stdout += text
          sendChunk(text)
        })

        child.stderr?.on('data', (data: Buffer) => {
          const text = data.toString('utf8')
          stderr += text
          sendChunk(text)
        })

        child.on('close', (code) => {
          resolve({
            exitCode: killed ? 1 : (code ?? 0),
            stdout: sanitizeOutput(stdout, 50000),
            stderr: sanitizeOutput(stderr, 10000),
          })
        })

        child.on('error', (err) => {
          resolve({
            exitCode: 1,
            stdout: sanitizeOutput(stdout, 50000),
            stderr: sanitizeOutput(stderr, 10000),
            error: err.message,
          })
        })

        // Safety: kill on timeout
        setTimeout(() => {
          if (child.exitCode === null) {
            killed = true
            child.kill('SIGTERM')
          }
        }, timeout)
      })
    }
  )

  ipcMain.handle('shell:openPath', async (_event, folderPath: string) => {
    return shell.openPath(folderPath)
  })

  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      return shell.openExternal(url)
    }
  })
}
