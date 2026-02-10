import { ipcMain, BrowserWindow } from 'electron'
import * as https from 'https'
import * as http from 'http'
import { URL } from 'url'

interface APIStreamRequest {
  requestId: string
  url: string
  method: string
  headers: Record<string, string>
  body?: string
}

export function registerApiProxyHandlers(): void {
  // Handle streaming API requests from renderer
  ipcMain.on('api:stream-request', (event, req: APIStreamRequest) => {
    const { requestId, url, method, headers, body } = req
    const parsedUrl = new URL(url)
    const isHttps = parsedUrl.protocol === 'https:'
    const httpModule = isHttps ? https : http

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers,
    }

    console.log(`[API Proxy] ${method} ${url}`)

    const httpReq = httpModule.request(options, (res) => {
      const statusCode = res.statusCode || 0

      // For non-2xx, collect full body and send as error
      if (statusCode < 200 || statusCode >= 300) {
        let errorBody = ''
        res.on('data', (chunk: Buffer) => {
          errorBody += chunk.toString()
        })
        res.on('end', () => {
          const sender = getSender(event)
          if (sender) {
            sender.send('api:stream-error', {
              requestId,
              error: `HTTP ${statusCode}: ${errorBody.slice(0, 2000)}`,
            })
          }
        })
        return
      }

      // Stream SSE chunks to renderer
      res.on('data', (chunk: Buffer) => {
        const sender = getSender(event)
        if (sender) {
          sender.send('api:stream-chunk', {
            requestId,
            data: chunk.toString(),
          })
        }
      })

      res.on('end', () => {
        const sender = getSender(event)
        if (sender) {
          sender.send('api:stream-end', { requestId })
        }
      })

      res.on('error', (err) => {
        const sender = getSender(event)
        if (sender) {
          sender.send('api:stream-error', {
            requestId,
            error: err.message,
          })
        }
      })
    })

    httpReq.on('error', (err) => {
      const sender = getSender(event)
      if (sender) {
        sender.send('api:stream-error', {
          requestId,
          error: err.message,
        })
      }
    })

    // Handle abort from renderer
    const abortHandler = (_event: Electron.IpcMainEvent, data: { requestId: string }) => {
      if (data.requestId === requestId) {
        httpReq.destroy()
        ipcMain.removeListener('api:abort', abortHandler)
      }
    }
    ipcMain.on('api:abort', abortHandler)

    // Clean up abort listener when request completes
    httpReq.on('close', () => {
      ipcMain.removeListener('api:abort', abortHandler)
    })

    if (body) {
      httpReq.write(body)
    }
    httpReq.end()
  })
}

function getSender(event: Electron.IpcMainEvent): Electron.WebContents | null {
  try {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) {
      return event.sender
    }
  } catch {
    // Window may have been closed
  }
  return null
}
