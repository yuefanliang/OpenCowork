import { useState, useMemo } from 'react'
import {
  Plus,
  Search,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
  RefreshCw,
  Check,
  X,
  Brain,
} from 'lucide-react'
import { nanoid } from 'nanoid'
import { toast } from 'sonner'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Switch } from '@renderer/components/ui/switch'
import { Separator } from '@renderer/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import {
  useProviderStore,
  builtinProviderPresets,
} from '@renderer/stores/provider-store'
import type { ProviderType, AIModelConfig, AIProvider, ThinkingConfig } from '@renderer/lib/api/types'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { ProviderIcon, ModelIcon } from './provider-icons'

// --- Fetch models from provider API ---

async function fetchModelsFromProvider(
  type: ProviderType,
  baseUrl: string,
  apiKey: string,
  builtinId?: string
): Promise<AIModelConfig[]> {
  if (builtinId === 'openrouter') {
    const result = await window.electron.ipcRenderer.invoke('api:request', {
      url: 'https://openrouter.ai/api/frontend/models/find',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    if (result?.error) throw new Error(result.error)
    const data = JSON.parse(result.body)
    const models = data?.data?.models ?? data?.data ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return models.slice(0, 200).map((m: any) => ({
      id: m.slug ?? m.id,
      name: m.name ?? m.slug ?? m.id,
      enabled: true,
      contextLength: m.context_length,
    }))
  }

  // For OpenAI-compatible providers: GET /v1/models
  if (type === 'openai-chat' || type === 'openai-responses') {
    const url = `${(baseUrl || 'https://api.openai.com').replace(/\/+$/, '')}/v1/models`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
    const result = await window.electron.ipcRenderer.invoke('api:request', {
      url,
      method: 'GET',
      headers,
    })
    if (result?.error) throw new Error(result.error)
    if (result?.statusCode && result.statusCode >= 400) {
      throw new Error(`HTTP ${result.statusCode}: ${result.body?.slice(0, 200)}`)
    }
    const data = JSON.parse(result.body)
    const models = data?.data ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return models.map((m: any) => ({
      id: m.id,
      name: m.id,
      enabled: true,
    }))
  }

  // For Anthropic: no list API, return empty
  return []
}

// --- Add Custom Provider Dialog ---

function AddProviderDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}): React.JSX.Element {
  const addProvider = useProviderStore((s) => s.addProvider)
  const [name, setName] = useState('')
  const [type, setType] = useState<ProviderType>('openai-chat')
  const [baseUrl, setBaseUrl] = useState('')

  const handleAdd = (): void => {
    if (!name.trim()) return
    addProvider({
      id: nanoid(),
      name: name.trim(),
      type,
      apiKey: '',
      baseUrl: baseUrl.trim(),
      enabled: false,
      models: [],
      createdAt: Date.now(),
    })
    toast.success(`已添加服务商: ${name.trim()}`)
    setName(''); setBaseUrl(''); setType('openai-chat')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>添加自定义服务商</DialogTitle>
          <DialogDescription>添加一个 OpenAI 兼容或 Anthropic 协议的自定义 AI 服务商</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">服务商名称</label>
            <Input
              placeholder="如：我的代理服务"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">协议类型</label>
            <Select value={type} onValueChange={(v) => setType(v as ProviderType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai-chat">OpenAI Chat Completions 兼容</SelectItem>
                <SelectItem value="openai-responses">OpenAI Responses</SelectItem>
                <SelectItem value="anthropic">Anthropic Messages</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Base URL</label>
            <Input
              placeholder="https://api.example.com"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">API 接口的基础地址</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
            <Button disabled={!name.trim()} onClick={handleAdd}>添加</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// --- Right panel: provider config ---

function ProviderConfigPanel({ provider }: { provider: AIProvider }): React.JSX.Element {
  const updateProvider = useProviderStore((s) => s.updateProvider)
  const removeProvider = useProviderStore((s) => s.removeProvider)
  const toggleProviderEnabled = useProviderStore((s) => s.toggleProviderEnabled)
  const addModel = useProviderStore((s) => s.addModel)
  const removeModel = useProviderStore((s) => s.removeModel)
  const updateModel = useProviderStore((s) => s.updateModel)
  const toggleModelEnabled = useProviderStore((s) => s.toggleModelEnabled)
  const setProviderModels = useProviderStore((s) => s.setProviderModels)

  const [showKey, setShowKey] = useState(false)
  const [addingModel, setAddingModel] = useState(false)
  const [fetchingModels, setFetchingModels] = useState(false)
  const [testing, setTesting] = useState(false)
  const [newModelId, setNewModelId] = useState('')
  const [newModelName, setNewModelName] = useState('')
  const [modelSearch, setModelSearch] = useState('')
  const [editingThinkingModel, setEditingThinkingModel] = useState<AIModelConfig | null>(null)
  const [testModelId, setTestModelId] = useState(provider.models.find((m) => m.enabled)?.id ?? provider.models[0]?.id ?? '')

  const filteredModels = useMemo(() => {
    if (!modelSearch) return provider.models
    const q = modelSearch.toLowerCase()
    return provider.models.filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
  }, [provider.models, modelSearch])

  const handleTestConnection = async (): Promise<void> => {
    if (!provider.apiKey) { toast.error('未设置 API Key'); return }
    setTesting(true)
    try {
      const isAnthropic = provider.type === 'anthropic'
      const baseUrl = (provider.baseUrl || (isAnthropic ? 'https://api.anthropic.com' : 'https://api.openai.com/v1')).trim().replace(/\/+$/, '')
      const url = isAnthropic ? `${baseUrl}/v1/messages` : `${baseUrl}/chat/completions`
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (isAnthropic) {
        headers['x-api-key'] = provider.apiKey
        headers['anthropic-version'] = '2023-06-01'
      } else {
        headers['Authorization'] = `Bearer ${provider.apiKey}`
      }
      const model = testModelId || provider.models[0]?.id || 'gpt-4o'
      const body = JSON.stringify({ model, max_tokens: 1, messages: [{ role: 'user', content: 'Hi' }] })
      const result = await window.electron.ipcRenderer.invoke('api:request', { url, method: 'POST', headers, body })
      if (result?.error) {
        toast.error('连接失败', { description: result.error })
      } else {
        const status = result?.statusCode ?? 0
        if (status >= 200 && status < 300) toast.success('连接成功！')
        else if (status === 401 || status === 403) toast.error('API Key 无效', { description: `HTTP ${status}` })
        else toast.warning(`异常状态码: ${status}`, { description: result?.body?.slice(0, 200) })
      }
    } catch (err) {
      toast.error('连接失败', { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setTesting(false)
    }
  }

  const handleFetchModels = async (): Promise<void> => {
    setFetchingModels(true)
    try {
      const models = await fetchModelsFromProvider(provider.type, provider.baseUrl, provider.apiKey, provider.builtinId)
      if (models.length === 0) { toast.info('未获取到模型列表'); return }
      const existingMap = new Map(provider.models.map((m) => [m.id, m]))
      const merged = models.map((m) => {
        const existing = existingMap.get(m.id)
        return existing ? { ...m, enabled: existing.enabled } : m
      })
      setProviderModels(provider.id, merged)
      toast.success(`已获取 ${models.length} 个模型`)
    } catch (err) {
      toast.error('获取模型列表失败', { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setFetchingModels(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <ProviderIcon builtinId={provider.builtinId} size={24} />
          <div>
            <h3 className="text-sm font-semibold">{provider.name}</h3>
            <p className="text-[11px] text-muted-foreground">
              {provider.type === 'anthropic' ? 'Anthropic Messages API'
                : provider.type === 'openai-responses' ? 'OpenAI Responses API'
                : 'OpenAI Chat Completions 兼容'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!provider.builtinId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => {
                if (!window.confirm(`确定删除服务商 "${provider.name}"？`)) return
                removeProvider(provider.id)
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
          <Switch
            checked={provider.enabled}
            onCheckedChange={() => toggleProviderEnabled(provider.id)}
          />
        </div>
      </div>

      {/* Config body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* API Key */}
        <section className="space-y-2">
          <label className="text-sm font-medium">API Key</label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? 'text' : 'password'}
                placeholder="输入 API Key..."
                value={provider.apiKey}
                onChange={(e) => updateProvider(provider.id, { apiKey: e.target.value })}
                className="pr-9 text-xs"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
          </div>
        </section>

        {/* Base URL */}
        <section className="space-y-2">
          <label className="text-sm font-medium">API 代理地址</label>
          <Input
            placeholder={
              builtinProviderPresets.find((p) => p.builtinId === provider.builtinId)?.defaultBaseUrl || 'https://api.example.com'
            }
            value={provider.baseUrl}
            onChange={(e) => updateProvider(provider.id, { baseUrl: e.target.value })}
            className="text-xs"
          />
          <p className="text-[11px] text-muted-foreground">自定义端点，用于代理或第三方兼容服务</p>
        </section>

        {/* Connection check */}
        <section className="space-y-2">
          <label className="text-sm font-medium">连通性检查</label>
          <div className="flex items-center gap-2">
            <Select
              value={testModelId}
              onValueChange={(v) => setTestModelId(v)}
            >
              <SelectTrigger className="flex-1 text-xs">
                <SelectValue placeholder={provider.models[0]?.id || '无可用模型'} />
              </SelectTrigger>
              <SelectContent>
                {(provider.models.some((m) => m.enabled) ? provider.models.filter((m) => m.enabled) : provider.models).map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-9 shrink-0 gap-1.5 text-xs"
              disabled={!provider.apiKey || testing}
              onClick={handleTestConnection}
            >
              {testing && <Loader2 className="size-3 animate-spin" />}
              {testing ? '检查中...' : '检 查'}
            </Button>
          </div>
        </section>

        {/* Protocol type (for custom providers) */}
        {!provider.builtinId && (
          <section className="space-y-2">
            <label className="text-sm font-medium">协议类型</label>
            <Select
              value={provider.type}
              onValueChange={(v) => updateProvider(provider.id, { type: v as ProviderType })}
            >
              <SelectTrigger className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai-chat" className="text-xs">OpenAI Chat 兼容</SelectItem>
                <SelectItem value="openai-responses" className="text-xs">OpenAI Responses</SelectItem>
                <SelectItem value="anthropic" className="text-xs">Anthropic</SelectItem>
              </SelectContent>
            </Select>
          </section>
        )}

        <Separator />

        {/* Models */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">模型列表</label>
              <p className="text-[11px] text-muted-foreground">
                共 {provider.models.length} 个模型{provider.models.length > 0 && `，已启用 ${provider.models.filter((m) => m.enabled).length}`}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {provider.models.length > 0 && (
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                  <Input
                    placeholder="搜索模型..."
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    className="h-7 w-32 pl-7 text-[11px]"
                  />
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-[11px]"
                disabled={fetchingModels}
                onClick={handleFetchModels}
              >
                {fetchingModels ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                获取模型列表
              </Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setAddingModel(true)}>
                <Plus className="size-3.5" />
              </Button>
            </div>
          </div>

          {addingModel && (
            <div className="flex items-center gap-2">
              <Input
                placeholder="模型 ID (如 gpt-4o)"
                value={newModelId}
                onChange={(e) => setNewModelId(e.target.value)}
                className="flex-1 h-8 text-xs"
                autoFocus
              />
              <Input
                placeholder="显示名称 (可选)"
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                className="flex-1 h-8 text-xs"
              />
              <Button
                variant="ghost" size="sm" className="h-8 w-8 p-0"
                disabled={!newModelId.trim()}
                onClick={() => {
                  addModel(provider.id, { id: newModelId.trim(), name: newModelName.trim() || newModelId.trim(), enabled: true })
                  setNewModelId(''); setNewModelName(''); setAddingModel(false)
                }}
              >
                <Check className="size-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setAddingModel(false); setNewModelId(''); setNewModelName('') }}>
                <X className="size-3.5" />
              </Button>
            </div>
          )}

          <div className="rounded-lg border divide-y overflow-hidden" style={{ maxHeight: 320 }}>
            {filteredModels.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                {provider.models.length === 0 ? '暂无模型，点击「获取模型列表」或手动添加' : '无匹配结果'}
              </div>
            ) : (
              <div className="overflow-y-auto divide-y" style={{ maxHeight: 320 }}>
                {filteredModels.map((model) => (
                  <div
                    key={model.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 transition-colors group"
                  >
                    <ModelIcon icon={model.icon} modelId={model.id} providerBuiltinId={provider.builtinId} size={16} className="shrink-0 opacity-40" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium truncate">{model.name}</p>
                        <span className="text-[10px] text-muted-foreground/50 truncate">{model.id}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground/40">
                        {model.contextLength && (
                          <span>{Math.round(model.contextLength / 1024)}K context</span>
                        )}
                        {(model.inputPrice != null || model.outputPrice != null) && (
                          <span>
                            ${model.inputPrice ?? '?'} → ${model.outputPrice ?? '?'}
                          </span>
                        )}
                        {(model.cacheCreationPrice != null || model.cacheHitPrice != null) && (
                          <span className="text-emerald-500/60">
                            cache: {model.cacheCreationPrice != null ? `写 $${model.cacheCreationPrice}` : ''}{model.cacheCreationPrice != null && model.cacheHitPrice != null ? ' / ' : ''}{model.cacheHitPrice != null ? `读 $${model.cacheHitPrice}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className={`size-5 flex items-center justify-center rounded transition-colors ${
                            model.supportsThinking
                              ? 'text-violet-500 hover:bg-violet-500/10'
                              : 'text-muted-foreground/20 hover:text-muted-foreground/50 hover:bg-muted/40'
                          } opacity-0 group-hover:opacity-100`}
                          onClick={() => setEditingThinkingModel(model)}
                        >
                          <Brain className="size-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-[11px]">
                        {model.supportsThinking ? '编辑 Think 配置' : '配置 Think 支持'}
                      </TooltipContent>
                    </Tooltip>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                      onClick={() => removeModel(provider.id, model.id)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                    <Switch
                      checked={model.enabled}
                      onCheckedChange={() => toggleModelEnabled(provider.id, model.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Thinking config dialog */}
      {editingThinkingModel && (
        <ThinkingConfigDialog
          model={editingThinkingModel}
          open={!!editingThinkingModel}
          onOpenChange={(v) => { if (!v) setEditingThinkingModel(null) }}
          onSave={(supportsThinking, thinkingConfig) => {
            updateModel(provider.id, editingThinkingModel.id, {
              supportsThinking,
              thinkingConfig: supportsThinking ? thinkingConfig : undefined,
            })
            setEditingThinkingModel(null)
          }}
        />
      )}
    </div>
  )
}

// --- Thinking Config Dialog ---

function ThinkingConfigDialog({
  model,
  open,
  onOpenChange,
  onSave,
}: {
  model: AIModelConfig
  open: boolean
  onOpenChange: (v: boolean) => void
  onSave: (supportsThinking: boolean, thinkingConfig?: ThinkingConfig) => void
}): React.JSX.Element {
  const [enabled, setEnabled] = useState(model.supportsThinking ?? false)
  const [bodyParamsJson, setBodyParamsJson] = useState(
    model.thinkingConfig?.bodyParams ? JSON.stringify(model.thinkingConfig.bodyParams, null, 2) : '{\n  \n}'
  )
  const [forceTemp, setForceTemp] = useState(
    model.thinkingConfig?.forceTemperature?.toString() ?? ''
  )
  const [disabledBodyParamsJson, setDisabledBodyParamsJson] = useState(
    model.thinkingConfig?.disabledBodyParams ? JSON.stringify(model.thinkingConfig.disabledBodyParams, null, 2) : ''
  )
  const [jsonError, setJsonError] = useState('')

  const handleSave = (): void => {
    if (!enabled) {
      onSave(false)
      return
    }
    try {
      const parsed = JSON.parse(bodyParamsJson)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setJsonError('启用参数必须是 JSON 对象')
        return
      }
      const config: ThinkingConfig = { bodyParams: parsed }
      if (disabledBodyParamsJson.trim()) {
        try {
          const disabledParsed = JSON.parse(disabledBodyParamsJson)
          if (typeof disabledParsed === 'object' && disabledParsed !== null && !Array.isArray(disabledParsed)) {
            config.disabledBodyParams = disabledParsed
          } else {
            setJsonError('关闭参数必须是 JSON 对象')
            return
          }
        } catch {
          setJsonError('关闭参数 JSON 格式无效')
          return
        }
      }
      if (forceTemp.trim()) {
        const t = parseFloat(forceTemp)
        if (!isNaN(t)) config.forceTemperature = t
      }
      onSave(true, config)
    } catch {
      setJsonError('启用参数 JSON 格式无效')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>配置 Think 支持</DialogTitle>
          <DialogDescription>
            为模型 <span className="font-medium text-foreground">{model.name}</span> 配置深度思考参数
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">启用 Think 支持</label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {enabled && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">启用时 Body 参数 (JSON)</label>
                <p className="text-[11px] text-muted-foreground">启用 Think 时合并到请求 body 的额外参数</p>
                <textarea
                  value={bodyParamsJson}
                  onChange={(e) => { setBodyParamsJson(e.target.value); setJsonError('') }}
                  className="w-full h-24 rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">关闭时 Body 参数 (JSON，可选)</label>
                <p className="text-[11px] text-muted-foreground">关闭 Think 时合并到请求 body 的参数，留空则不发送</p>
                <textarea
                  value={disabledBodyParamsJson}
                  onChange={(e) => { setDisabledBodyParamsJson(e.target.value); setJsonError('') }}
                  className="w-full h-24 rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  spellCheck={false}
                  placeholder="留空则不发送"
                />
                {jsonError && <p className="text-[11px] text-destructive">{jsonError}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">强制 Temperature (可选)</label>
                <p className="text-[11px] text-muted-foreground">Anthropic 要求 temperature=1，留空则不覆盖</p>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  placeholder="留空不覆盖"
                  value={forceTemp}
                  onChange={(e) => setForceTemp(e.target.value)}
                  className="w-32 text-xs"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>取消</Button>
            <Button size="sm" onClick={handleSave}>保存</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// --- Main ProviderPanel ---

export function ProviderPanel(): React.JSX.Element {
  const providers = useProviderStore((s) => s.providers)

  const [selectedId, setSelectedId] = useState<string | null>(
    () => providers.find((p) => p.enabled)?.id ?? providers[0]?.id ?? null
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  const selectedProvider = providers.find((p) => p.id === selectedId) ?? null

  const enabledProviders = useMemo(
    () => providers.filter((p) => p.enabled && (!searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))),
    [providers, searchQuery]
  )
  const disabledProviders = useMemo(
    () => providers.filter((p) => !p.enabled && (!searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))),
    [providers, searchQuery]
  )

  return (
    <div className="flex flex-col h-full">
      <div className="mb-3 shrink-0">
        <h2 className="text-lg font-semibold">AI 服务商</h2>
        <p className="text-sm text-muted-foreground">管理你的 AI 模型服务商和 API 配置</p>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Provider list */}
        <div className="w-52 shrink-0 border-r flex flex-col">
          {/* Search + Add */}
          <div className="flex items-center gap-1 p-2 border-b">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
              <Input
                placeholder="搜索服务商..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 pl-7 text-[11px] bg-transparent border-0 shadow-none focus-visible:ring-0"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => setDialogOpen(true)}
              title="添加自定义服务商"
            >
              <Plus className="size-4" />
            </Button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto py-1">
            {enabledProviders.length > 0 && (
              <div className="px-2 pt-1.5 pb-1">
                <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider px-1">已启用</p>
                {enabledProviders.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 mt-0.5 text-left transition-colors ${
                      selectedId === p.id
                        ? 'bg-accent text-accent-foreground'
                        : 'text-foreground/80 hover:bg-muted/60'
                    }`}
                  >
                    <ProviderIcon builtinId={p.builtinId} size={16} />
                    <span className="flex-1 truncate text-xs">{p.name}</span>
                    <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {disabledProviders.length > 0 && (
              <div className="px-2 pt-2 pb-1">
                <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider px-1">未启用</p>
                {disabledProviders.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 mt-0.5 text-left transition-colors ${
                      selectedId === p.id
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    }`}
                  >
                    <ProviderIcon builtinId={p.builtinId} size={16} className="opacity-50" />
                    <span className="flex-1 truncate text-xs">{p.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Config panel */}
        <div className="flex-1 min-w-0">
          {selectedProvider ? (
            <ProviderConfigPanel provider={selectedProvider} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              选择一个服务商开始配置
            </div>
          )}
        </div>
      </div>

      {/* Add provider dialog */}
      <AddProviderDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
