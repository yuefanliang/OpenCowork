import {
  Settings,
  BrainCircuit,
  Info,
  Server,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { useUIStore, type SettingsTab } from '@renderer/stores/ui-store'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { formatTokens } from '@renderer/lib/format-tokens'
import { useDebouncedTokens } from '@renderer/hooks/use-estimated-tokens'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Textarea } from '@renderer/components/ui/textarea'
import { Separator } from '@renderer/components/ui/separator'
import { Slider } from '@renderer/components/ui/slider'
import { Switch } from '@renderer/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { useProviderStore } from '@renderer/stores/provider-store'
import { ProviderPanel } from './ProviderPanel'
import { WindowControls } from '@renderer/components/layout/WindowControls'

interface MenuItem {
  id: SettingsTab
  label: string
  icon: React.ReactNode
  description: string
}

const menuItems: MenuItem[] = [
  { id: 'general', label: '通用设置', icon: <Settings className="size-4" />, description: '主题、语言与基本偏好' },
  { id: 'provider', label: 'AI 服务商', icon: <Server className="size-4" />, description: '管理 AI 模型服务商' },
  { id: 'model', label: '模型配置', icon: <BrainCircuit className="size-4" />, description: '模型选择与生成参数' },
  { id: 'about', label: '关于', icon: <Info className="size-4" />, description: '版本信息与项目链接' },
]

// ─── General Settings Panel ───

function GeneralPanel(): React.JSX.Element {
  const settings = useSettingsStore()
  const { setTheme } = useTheme()
  const promptTokens = useDebouncedTokens(settings.systemPrompt)

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">通用设置</h2>
        <p className="text-sm text-muted-foreground">主题、语言与基本偏好</p>
      </div>

      {/* Theme */}
      <section className="space-y-3">
        <div>
          <label className="text-sm font-medium">主题</label>
          <p className="text-xs text-muted-foreground">选择应用的外观主题</p>
        </div>
        <Select
          value={settings.theme}
          onValueChange={(v: 'light' | 'dark' | 'system') => {
            settings.updateSettings({ theme: v })
            setTheme(v)
          }}
        >
          <SelectTrigger className="w-60 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light" className="text-xs">浅色</SelectItem>
            <SelectItem value="dark" className="text-xs">深色</SelectItem>
            <SelectItem value="system" className="text-xs">跟随系统</SelectItem>
          </SelectContent>
        </Select>
      </section>

      <Separator />

      {/* Language */}
      <section className="space-y-3">
        <div>
          <label className="text-sm font-medium">语言</label>
          <p className="text-xs text-muted-foreground">设置界面显示语言</p>
        </div>
        <Select
          value={settings.language}
          onValueChange={(v: 'en' | 'zh') => settings.updateSettings({ language: v })}
        >
          <SelectTrigger className="w-60 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="zh" className="text-xs">中文</SelectItem>
            <SelectItem value="en" className="text-xs">English</SelectItem>
          </SelectContent>
        </Select>
      </section>

      <Separator />

      {/* System Prompt */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium">系统提示词</label>
            <p className="text-xs text-muted-foreground">自定义指令，将追加到内置系统提示词之后</p>
          </div>
          {settings.systemPrompt && (
            <span className="text-[10px] text-muted-foreground/50 tabular-nums">{promptTokens > 0 ? `~${formatTokens(promptTokens)} tokens` : ''}</span>
          )}
        </div>
        <Textarea
          placeholder="添加自定义指令..."
          value={settings.systemPrompt}
          onChange={(e) => settings.updateSettings({ systemPrompt: e.target.value })}
          rows={4}
          className="max-w-lg"
        />
      </section>

      <Separator />

      {/* Team Tools */}
      <section className="space-y-3">
        <div className="flex items-center justify-between max-w-lg">
          <div>
            <label className="text-sm font-medium">Team Tools</label>
            <p className="text-xs text-muted-foreground">启用 Agent Team 协作功能，允许 AI 创建和管理并行团队</p>
          </div>
          <Switch
            checked={settings.teamToolsEnabled}
            onCheckedChange={(checked) => settings.updateSettings({ teamToolsEnabled: checked })}
          />
        </div>
        {settings.teamToolsEnabled && (
          <p className="text-xs text-muted-foreground/70">已启用：AI 可使用 TeamCreate、SpawnTeammate 等工具进行多智能体协作</p>
        )}
      </section>

      <Separator />

      {/* Auto Approve */}
      <section className="space-y-3">
        <div className="flex items-center justify-between max-w-lg">
          <div>
            <label className="text-sm font-medium">自动批准工具调用</label>
            <p className="text-xs text-muted-foreground">跳过所有工具调用的权限确认对话框</p>
          </div>
          <Switch
            checked={settings.autoApprove}
            onCheckedChange={(checked) => {
              if (checked && !window.confirm('启用自动批准？所有工具调用将不经确认直接执行。')) return
              settings.updateSettings({ autoApprove: checked })
            }}
          />
        </div>
        {settings.autoApprove && (
          <p className="text-xs text-destructive">危险：所有工具调用将自动执行，无需确认</p>
        )}
      </section>

      <Separator />

      {/* Developer Mode */}
      <section className="space-y-3">
        <div className="flex items-center justify-between max-w-lg">
          <div>
            <label className="text-sm font-medium">开发者模式</label>
            <p className="text-xs text-muted-foreground">出错时在 AI 回复中显示请求调试信息</p>
          </div>
          <Switch
            checked={settings.devMode}
            onCheckedChange={(checked) => settings.updateSettings({ devMode: checked })}
          />
        </div>
      </section>

      <Separator />

      {/* Reset */}
      <section>
        <Button
          variant="outline"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={() => {
            if (!window.confirm('重置所有设置为默认值？API Key 将被保留。')) return
            const currentKey = settings.apiKey
            settings.updateSettings({
              provider: 'anthropic',
              baseUrl: '',
              model: 'claude-sonnet-4-20250514',
              fastModel: 'claude-3-5-haiku-20241022',
              maxTokens: 32000,
              temperature: 0.7,
              systemPrompt: '',
              theme: 'system',
              apiKey: currentKey,
            })
            setTheme('system')
            toast.success('已重置为默认设置')
          }}
        >
          重置为默认
        </Button>
      </section>
    </div>
  )
}

// ─── Model Configuration Panel ───

function ModelPanel(): React.JSX.Element {
  const settings = useSettingsStore()
  const providers = useProviderStore((s) => s.providers)
  const activeProviderId = useProviderStore((s) => s.activeProviderId)
  const activeModelId = useProviderStore((s) => s.activeModelId)
  const activeFastModelId = useProviderStore((s) => s.activeFastModelId)
  const setActiveProvider = useProviderStore((s) => s.setActiveProvider)
  const setActiveModel = useProviderStore((s) => s.setActiveModel)
  const setActiveFastModel = useProviderStore((s) => s.setActiveFastModel)

  const enabledProviders = providers.filter((p) => p.enabled)
  const activeProvider = providers.find((p) => p.id === activeProviderId) ?? null
  const enabledModels = activeProvider?.models.filter((m) => m.enabled) ?? []

  const noProviders = enabledProviders.length === 0

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">模型配置</h2>
        <p className="text-sm text-muted-foreground">选择 AI 服务商和模型，调整生成参数</p>
      </div>

      {noProviders ? (
        <div className="rounded-lg border border-dashed p-6 text-center space-y-2">
          <p className="text-sm text-muted-foreground">尚未启用任何 AI 服务商</p>
          <p className="text-xs text-muted-foreground/60">请先前往「AI 服务商」页面启用并配置服务商</p>
        </div>
      ) : (
        <>
          {/* Provider Selection */}
          <section className="space-y-3">
            <div>
              <label className="text-sm font-medium">AI 服务商</label>
              <p className="text-xs text-muted-foreground">选择已启用的服务商</p>
            </div>
            <Select
              value={activeProviderId ?? ''}
              onValueChange={(v) => setActiveProvider(v)}
            >
              <SelectTrigger className="w-80 text-xs">
                <SelectValue placeholder="选择服务商" />
              </SelectTrigger>
              <SelectContent>
                {enabledProviders.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <Separator />

          {/* Main Model */}
          <section className="space-y-3">
            <div>
              <label className="text-sm font-medium">主模型</label>
              <p className="text-xs text-muted-foreground">用于对话和主要任务的模型</p>
            </div>
            {enabledModels.length > 0 ? (
              <Select value={activeModelId} onValueChange={(v) => setActiveModel(v)}>
                <SelectTrigger className="w-80 text-xs">
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectContent>
                  {enabledModels.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      {m.name}
                      <span className="ml-2 text-muted-foreground/50">{m.id}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground/60">
                当前服务商无可用模型，请前往「AI 服务商」页面添加模型
              </p>
            )}
          </section>

          {/* Fast Model */}
          <section className="space-y-3">
            <div>
              <label className="text-sm font-medium">快速模型</label>
              <p className="text-xs text-muted-foreground">
                用于会话标题生成和子代理任务（更便宜、更快）
              </p>
            </div>
            {enabledModels.length > 0 ? (
              <Select
                value={activeFastModelId || enabledModels[0]?.id || ''}
                onValueChange={(v) => setActiveFastModel(v)}
              >
                <SelectTrigger className="w-80 text-xs">
                  <SelectValue placeholder="选择快速模型" />
                </SelectTrigger>
                <SelectContent>
                  {enabledModels.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      {m.name}
                      <span className="ml-2 text-muted-foreground/50">{m.id}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground/60">
                当前服务商无可用模型
              </p>
            )}
          </section>
        </>
      )}

      <Separator />

      {/* Temperature */}
      <section className="space-y-3">
        <div className="flex items-center justify-between max-w-lg">
          <div>
            <label className="text-sm font-medium">Temperature</label>
            <p className="text-xs text-muted-foreground">控制生成文本的随机性</p>
          </div>
          <span className="text-sm font-mono text-muted-foreground">{settings.temperature}</span>
        </div>
        <Slider
          value={[settings.temperature]}
          onValueChange={([v]) => settings.updateSettings({ temperature: v })}
          min={0}
          max={1}
          step={0.1}
          className="max-w-lg"
        />
        <div className="flex items-center justify-between max-w-lg">
          {[
            { v: 0, label: '精确' },
            { v: 0.3, label: '平衡' },
            { v: 0.7, label: '创意' },
            { v: 1, label: '随机' },
          ].map(({ v, label }) => (
            <button
              key={v}
              onClick={() => settings.updateSettings({ temperature: v })}
              className={`text-[10px] transition-colors ${settings.temperature === v ? 'text-foreground font-medium' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Max Tokens */}
      <section className="space-y-3">
        <div>
          <label className="text-sm font-medium">最大 Token 数</label>
          <p className="text-xs text-muted-foreground">单次响应的最大 Token 限制</p>
        </div>
        <Input
          type="number"
          value={settings.maxTokens}
          onChange={(e) =>
            settings.updateSettings({ maxTokens: parseInt(e.target.value) || 32000 })
          }
          className="max-w-60"
        />
        <div className="flex items-center gap-1">
          {[8192, 16384, 32000, 64000, 128000].map((v) => (
            <button
              key={v}
              onClick={() => settings.updateSettings({ maxTokens: v })}
              className={`rounded px-2 py-0.5 text-[10px] transition-colors ${settings.maxTokens === v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
            >
              {v >= 1000 ? `${Math.round(v / 1024)}K` : v}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

// ─── About Panel ───

function AboutPanel(): React.JSX.Element {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">关于</h2>
        <p className="text-sm text-muted-foreground">版本信息与项目链接</p>
      </div>

      <div className="flex items-center gap-4">
        <img
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%230ea5e9'/%3E%3Ccircle cx='35' cy='40' r='14' fill='%23fff'/%3E%3Ccircle cx='65' cy='40' r='14' fill='%23fff' opacity='.85'/%3E%3Cpath d='M25 68 Q50 85 75 68' stroke='%23fff' stroke-width='6' fill='none' stroke-linecap='round'/%3E%3C/svg%3E"
          alt="OpenCowork"
          className="size-16 rounded-2xl shadow-md"
        />
        <div>
          <h3 className="text-xl font-bold">OpenCowork</h3>
          <p className="text-sm text-muted-foreground">AI 协作工作台</p>
        </div>
      </div>

      <Separator />

      <section className="space-y-4">
        <div className="grid grid-cols-[120px_1fr] gap-y-3 text-sm">
          <span className="text-muted-foreground">版本</span>
          <span className="font-mono">0.1.0</span>
          <span className="text-muted-foreground">框架</span>
          <span>Electron + React + TypeScript</span>
          <span className="text-muted-foreground">UI</span>
          <span>shadcn/ui + TailwindCSS</span>
          <span className="text-muted-foreground">许可证</span>
          <span>MIT</span>
        </div>
      </section>

      <Separator />

      <section className="space-y-2">
        <p className="text-xs text-muted-foreground">
          OpenCowork 是一个开源的 AI 协作平台，支持多种大语言模型提供商。
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => window.open('https://github.com/AIDotNet/OpenCowork', '_blank')}
          >
            GitHub
          </Button>
        </div>
      </section>
    </div>
  )
}

// ─── Main Settings Page ───

const panelMap: Record<SettingsTab, () => React.JSX.Element> = {
  general: GeneralPanel,
  provider: ProviderPanel,
  model: ModelPanel,
  about: AboutPanel,
}

export function SettingsPage(): React.JSX.Element {
  const settingsTab = useUIStore((s) => s.settingsTab)
  const setSettingsTab = useUIStore((s) => s.setSettingsTab)

  const ActivePanel = panelMap[settingsTab]

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Left Sidebar - LobeHub Style */}
      <div className="flex w-64 shrink-0 flex-col border-r bg-muted/20">
        {/* Titlebar drag area */}
        <div className="titlebar-drag h-10 w-full shrink-0" />

        {/* Header */}
        <div className="px-5 pb-5">
          <h1 className="text-xl font-bold">设置</h1>
          <p className="mt-1 text-xs text-muted-foreground">偏好与模型设置</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSettingsTab(item.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all duration-150 ${
                settingsTab === item.id
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              }`}
            >
              <span className={`flex items-center justify-center size-5 ${
                settingsTab === item.id ? 'text-accent-foreground' : 'text-muted-foreground'
              }`}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 text-[11px] text-muted-foreground/50">
          Powered by <span className="font-medium text-muted-foreground/70">OpenCowork</span>
        </div>
      </div>

      {/* Right Content */}
      <div className="relative flex-1 flex flex-col">
        {/* Fixed titlebar area */}
        <div className="titlebar-drag h-10 w-full shrink-0" />
        <div className="absolute right-0 top-0 z-10">
          <WindowControls />
        </div>
        {/* Content */}
        {settingsTab === 'provider' ? (
          <div className="flex-1 min-h-0 px-6 pb-4">
            <ActivePanel />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl px-8 pb-16">
              <ActivePanel />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
