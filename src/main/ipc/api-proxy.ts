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

function readTimeoutFromEnv(name: string, fallbackMs: number): number {
  const raw = process.env[name]
  if (raw == null || raw === '') return fallbackMs
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) return fallbackMs
  return Math.floor(parsed)
}

export function registerApiProxyHandlers(): void {
  // Handle non-streaming API requests (e.g., test connection)
  ipcMain.handle('api:request', async (_event, req: Omit<APIStreamRequest, 'requestId'>) => {
    const { url, method, headers, body } = req
    try {
      console.log(`[API Proxy] request ${method} ${url}`)
      const parsedUrl = new URL(url)
      const isHttps = parsedUrl.protocol === 'https:'
      const httpModule = isHttps ? https : http

      const bodyBuffer = body ? Buffer.from(body, 'utf-8') : null
      const reqHeaders = { ...headers }
      if (bodyBuffer) {
        reqHeaders['Content-Length'] = String(bodyBuffer.byteLength)
      }

      return new Promise((resolve) => {
        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          method,
          headers: reqHeaders,
        }

        const httpReq = httpModule.request(options, (res) => {
          let responseBody = ''
          res.on('data', (chunk: Buffer) => { responseBody += chunk.toString() })
          res.on('end', () => {
            resolve({ statusCode: res.statusCode, body: responseBody })
          })
        })

        httpReq.on('error', (err) => {
          console.error(`[API Proxy] request error: ${err.message}`)
          resolve({ statusCode: 0, error: err.message })
        })

        httpReq.setTimeout(15000, () => {
          httpReq.destroy()
          resolve({ statusCode: 0, error: 'Request timed out (15s)' })
        })

        if (bodyBuffer) httpReq.write(bodyBuffer)
        httpReq.end()
      })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error(`[API Proxy] request fatal error: ${errMsg}`)
      return { statusCode: 0, error: errMsg }
    }
  })

  // Handle streaming API requests from renderer
  ipcMain.on('api:stream-request', (event, req: APIStreamRequest) => {
    const { requestId, url, method, headers, body } = req

    try {
      console.log(`[API Proxy] stream-request[${requestId}] ${method} ${url}`)
      const parsedUrl = new URL(url)
      const isHttps = parsedUrl.protocol === 'https:'
      const httpModule = isHttps ? https : http

      const bodyBuffer = body ? Buffer.from(body, 'utf-8') : null
      const reqHeaders = { ...headers }
      if (bodyBuffer) {
        reqHeaders['Content-Length'] = String(bodyBuffer.byteLength)
      }

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: reqHeaders,
      }

      // Timeouts (ms):
      // - Connection: max wait for the server to start responding (first byte)
      // - Idle: max gap between consecutive data chunks during streaming
      const CONNECTION_TIMEOUT = readTimeoutFromEnv(
        'OPENCOWORK_API_CONNECTION_TIMEOUT_MS',
        180_000
      )
      const IDLE_TIMEOUT = readTimeoutFromEnv(
        'OPENCOWORK_API_IDLE_TIMEOUT_MS',
        300_000
      )
      let idleTimer: ReturnType<typeof setTimeout> | null = null

      const clearIdleTimer = (): void => {
        if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
      }

      const resetIdleTimer = (req: http.ClientRequest): void => {
        if (IDLE_TIMEOUT <= 0) return
        clearIdleTimer()
        idleTimer = setTimeout(() => {
          console.warn(`[API Proxy] Idle timeout (${IDLE_TIMEOUT}ms) for ${requestId}`)
          req.destroy(new Error(`Stream idle timeout (${IDLE_TIMEOUT / 1000}s with no data)`))
        }, IDLE_TIMEOUT)
      }

      const httpReq = httpModule.request(options, (res) => {
        const statusCode = res.statusCode || 0

        // For non-2xx, collect full body and send as error
        if (statusCode < 200 || statusCode >= 300) {
          clearIdleTimer()
          let errorBody = ''
          res.on('data', (chunk: Buffer) => {
            if (errorBody.length < 4000) errorBody += chunk.toString()
          })
          res.on('end', () => {
            console.error(`[API Proxy] stream-request[${requestId}] HTTP ${statusCode}: ${errorBody.slice(0, 500)}`)
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
          resetIdleTimer(httpReq)
          const sender = getSender(event)
          if (sender) {
            sender.send('api:stream-chunk', {
              requestId,
              data: chunk.toString(),
            })
          }
        })

        res.on('end', () => {
          clearIdleTimer()
          const sender = getSender(event)
          if (sender) {
            sender.send('api:stream-end', { requestId })
          }
        })

        res.on('error', (err) => {
          clearIdleTimer()
          console.error(`[API Proxy] stream-request[${requestId}] response error: ${err.message}`)
          const sender = getSender(event)
          if (sender) {
            sender.send('api:stream-error', {
              requestId,
              error: err.message,
            })
          }
        })
      })

      // Connection timeout: abort if the server doesn't respond at all
      if (CONNECTION_TIMEOUT > 0) {
        httpReq.setTimeout(CONNECTION_TIMEOUT, () => {
          console.warn(`[API Proxy] Connection timeout (${CONNECTION_TIMEOUT}ms) for ${requestId}`)
          httpReq.destroy(new Error(`Connection timeout (${CONNECTION_TIMEOUT / 1000}s)`))
        })
      }

      httpReq.on('error', (err) => {
        clearIdleTimer()
        console.error(`[API Proxy] stream-request[${requestId}] request error: ${err.message}`)
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
          clearIdleTimer()
          httpReq.destroy()
          ipcMain.removeListener('api:abort', abortHandler)
        }
      }
      ipcMain.on('api:abort', abortHandler)

      // Clean up abort listener and timers when request completes
      httpReq.on('close', () => {
        clearIdleTimer()
        ipcMain.removeListener('api:abort', abortHandler)
      })

      if (bodyBuffer) {
        httpReq.write(bodyBuffer)
      }
      httpReq.end()
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error(`[API Proxy] stream-request[${requestId}] fatal error: ${errMsg}`)
      const sender = getSender(event)
      if (sender) {
        sender.send('api:stream-error', {
          requestId,
          error: errMsg,
        })
      }
    }
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
