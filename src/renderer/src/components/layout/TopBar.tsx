import { MessageSquare, Briefcase, Code2, Settings, PanelRightOpen, PanelRightClose, Sun, Moon } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { SidebarTrigger } from '@renderer/components/ui/sidebar'
import { Separator } from '@renderer/components/ui/separator'
import { useUIStore, type AppMode } from '@renderer/stores/ui-store'
import { cn } from '@renderer/lib/utils'
import { useTheme } from 'next-themes'

const modes: { value: AppMode; label: string; icon: React.ReactNode }[] = [
  { value: 'chat', label: 'Chat', icon: <MessageSquare className="size-4" /> },
  { value: 'cowork', label: 'Cowork', icon: <Briefcase className="size-4" /> },
  { value: 'code', label: 'Code', icon: <Code2 className="size-4" /> },
]

export function TopBar(): React.JSX.Element {
  const mode = useUIStore((s) => s.mode)
  const setMode = useUIStore((s) => s.setMode)
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen)
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const { theme, setTheme } = useTheme()

  const toggleTheme = (): void => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />

      {/* Mode Selector */}
      <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
        {modes.map((m) => (
          <Button
            key={m.value}
            variant={mode === m.value ? 'secondary' : 'ghost'}
            size="sm"
            className={cn(
              'h-7 gap-1.5 px-2.5 text-xs font-medium',
              mode === m.value && 'bg-background shadow-sm'
            )}
            onClick={() => setMode(m.value)}
          >
            {m.icon}
            {m.label}
          </Button>
        ))}
      </div>

      <div className="flex-1" />

      {/* Right Panel Toggle (cowork & code modes) */}
      {mode !== 'chat' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" onClick={toggleRightPanel}>
              {rightPanelOpen ? (
                <PanelRightClose className="size-4" />
              ) : (
                <PanelRightOpen className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle Panel</TooltipContent>
        </Tooltip>
      )}

      {/* Theme Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Toggle Theme</TooltipContent>
      </Tooltip>

      {/* Settings */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Settings</TooltipContent>
      </Tooltip>
    </header>
  )
}
