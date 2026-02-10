import { useEffect } from 'react'
import { Layout } from './components/layout/Layout'
import { Toaster } from './components/ui/sonner'
import { ThemeProvider } from './components/theme-provider'
import { ErrorBoundary } from './components/error-boundary'
import { useSettingsStore } from './stores/settings-store'
import { registerAllTools } from './lib/tools'
import { registerAllProviders } from './lib/api'

// Register all built-in tools and API providers at startup
registerAllTools()
registerAllProviders()

function App(): React.JSX.Element {
  const theme = useSettingsStore((s) => s.theme)

  // Load API key from secure main process storage on startup
  useEffect(() => {
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

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme={theme}>
        <Layout />
        <Toaster position="bottom-right" theme="system" richColors />
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
