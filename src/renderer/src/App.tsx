import { useEffect } from 'react'
import { Layout } from './components/layout/Layout'
import { Toaster } from './components/ui/sonner'
import { ConfirmDialogProvider } from './components/ui/confirm-dialog'
import { ThemeProvider } from './components/theme-provider'
import { ErrorBoundary } from './components/error-boundary'
import { useSettingsStore } from './stores/settings-store'
import { initProviderStore } from './stores/provider-store'
import { useChatStore } from './stores/chat-store'
import { usePlanStore } from './stores/plan-store'
import { registerAllTools } from './lib/tools'
import { registerAllProviders } from './lib/api'
import { registerAllViewers } from './lib/preview/register-viewers'
import { initPluginEventListener } from './stores/plugin-store'
import { toast } from 'sonner'
import i18n from './locales'

// Register synchronous providers and viewers immediately at startup
registerAllProviders()
registerAllViewers()
initProviderStore()

// Register tools (async because SubAgents are loaded from .md files via IPC)
registerAllTools().catch((err) => console.error('[App] Failed to register tools:', err))

// Initialize plugin incoming event listener
initPluginEventListener()

function App(): React.JSX.Element {
  const theme = useSettingsStore((s) => s.theme)

  // Load sessions from SQLite and API key from secure main process storage on startup
  useEffect(() => {
    useChatStore.getState().loadFromDb()
    usePlanStore.getState().loadPlansFromDb()
    window.electron.ipcRenderer
      .invoke('settings:get', 'apiKey')
      .then((key) => {
        if (typeof key === 'string' && key) {
          useSettingsStore.getState().updateSettings({ apiKey: key })
        }
      })
      .catch(() => {
        // Ignore — main process may not have a stored key yet
      })
  }, [])

  // Sync i18n language with settings store
  const language = useSettingsStore((s) => s.language)
  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language)
    }
  }, [language])

  // Global unhandled promise rejection handler
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent): void => {
      console.error('[Unhandled Rejection]', e.reason)
      toast.error('Unhandled Error', {
        description: e.reason?.message || String(e.reason),
      })
    }
    window.addEventListener('unhandledrejection', handler)
    return () => window.removeEventListener('unhandledrejection', handler)
  }, [])

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme={theme}>
        <Layout />
        <Toaster position="bottom-right" theme="system" richColors />
        <ConfirmDialogProvider />
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
