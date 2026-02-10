import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Separator } from '@renderer/components/ui/separator'
import { Slider } from '@renderer/components/ui/slider'
import { Textarea } from '@renderer/components/ui/textarea'
import { useTheme } from 'next-themes'
import { useUIStore } from '@renderer/stores/ui-store'
import { useSettingsStore } from '@renderer/stores/settings-store'
import type { ProviderType } from '@renderer/lib/api/types'
import { Button } from '@renderer/components/ui/button'

const providerOptions: { value: ProviderType; label: string }[] = [
  { value: 'anthropic', label: 'Anthropic Messages' },
  { value: 'openai-chat', label: 'OpenAI Chat Completions' },
  { value: 'openai-responses', label: 'OpenAI Responses' },
]

const modelPresets: Record<ProviderType, string[]> = {
  anthropic: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-3-5-haiku-20241022'],
  'openai-chat': ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  'openai-responses': ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
}

const defaultModels: Record<ProviderType, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  'openai-chat': 'gpt-4o',
  'openai-responses': 'gpt-4o',
}

export function SettingsDialog(): React.JSX.Element {
  const open = useUIStore((s) => s.settingsOpen)
  const setOpen = useUIStore((s) => s.setSettingsOpen)
  const settings = useSettingsStore()
  const { setTheme } = useTheme()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Configure API providers and preferences</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Provider Selection */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium">API Provider</h3>
            <div className="flex gap-2">
              {providerOptions.map((p) => (
                <Button
                  key={p.value}
                  variant={settings.provider === p.value ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs"
                  onClick={() => settings.updateSettings({ provider: p.value, model: defaultModels[p.value] })}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </section>

          <Separator />

          {/* API Key */}
          <section className="space-y-2">
            <label className="text-sm font-medium">API Key</label>
            <Input
              type="password"
              placeholder="Enter your API key..."
              value={settings.apiKey}
              onChange={(e) => {
                settings.updateSettings({ apiKey: e.target.value })
                window.electron.ipcRenderer.invoke('settings:set', {
                  key: 'apiKey',
                  value: e.target.value,
                })
              }}
            />
            <p className="text-xs text-muted-foreground">
              Stored securely in the main process, not in browser storage
            </p>
          </section>

          {/* Base URL */}
          <section className="space-y-2">
            <label className="text-sm font-medium">Base URL (optional)</label>
            <Input
              placeholder="https://api.anthropic.com"
              value={settings.baseUrl}
              onChange={(e) => settings.updateSettings({ baseUrl: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Custom endpoint for proxies or third-party compatible services
            </p>
          </section>

          {/* Model */}
          <section className="space-y-2">
            <label className="text-sm font-medium">Model</label>
            <Input
              placeholder="claude-sonnet-4-20250514"
              value={settings.model}
              onChange={(e) => settings.updateSettings({ model: e.target.value })}
            />
            <div className="flex flex-wrap gap-1">
              {modelPresets[settings.provider]?.map((m) => (
                <Button
                  key={m}
                  variant={settings.model === m ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => settings.updateSettings({ model: m })}
                >
                  {m}
                </Button>
              ))}
            </div>
          </section>

          <Separator />

          {/* Temperature */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Temperature</label>
              <span className="text-xs text-muted-foreground">{settings.temperature}</span>
            </div>
            <Slider
              value={[settings.temperature]}
              onValueChange={([v]) => settings.updateSettings({ temperature: v })}
              min={0}
              max={1}
              step={0.1}
            />
          </section>

          {/* Max Tokens */}
          <section className="space-y-2">
            <label className="text-sm font-medium">Max Tokens</label>
            <Input
              type="number"
              value={settings.maxTokens}
              onChange={(e) =>
                settings.updateSettings({ maxTokens: parseInt(e.target.value) || 32000 })
              }
            />
          </section>

          <Separator />

          {/* System Prompt */}
          <section className="space-y-2">
            <label className="text-sm font-medium">System Prompt (optional)</label>
            <Textarea
              placeholder="You are a helpful assistant..."
              value={settings.systemPrompt}
              onChange={(e) => settings.updateSettings({ systemPrompt: e.target.value })}
              rows={3}
            />
          </section>

          {/* Theme */}
          <section className="space-y-2">
            <label className="text-sm font-medium">Theme</label>
            <div className="flex gap-2">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <Button
                  key={t}
                  variant={settings.theme === t ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs capitalize"
                  onClick={() => { settings.updateSettings({ theme: t }); setTheme(t) }}
                >
                  {t}
                </Button>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
