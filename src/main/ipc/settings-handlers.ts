import { ipcMain, app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const SETTINGS_FILE = 'settings.json'

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), SETTINGS_FILE)
}

function readSettings(): Record<string, unknown> {
  try {
    const filePath = getSettingsPath()
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    }
  } catch {
    // Return empty on any error
  }
  return {}
}

function writeSettings(settings: Record<string, unknown>): void {
  try {
    const filePath = getSettingsPath()
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8')
  } catch (err) {
    console.error('[Settings] Write error:', err)
  }
}

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', async (_event, key?: string) => {
    const settings = readSettings()
    if (key) return settings[key]
    return settings
  })

  ipcMain.handle('settings:set', async (_event, args: { key: string; value: unknown }) => {
    const settings = readSettings()
    settings[args.key] = args.value
    writeSettings(settings)
    return { success: true }
  })
}
