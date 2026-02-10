import { ListChecks, FileOutput, Database, Sparkles } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Separator } from '@renderer/components/ui/separator'
import { useUIStore, type RightPanelTab } from '@renderer/stores/ui-store'
import { StepsPanel } from '@renderer/components/cowork/StepsPanel'
import { ArtifactsPanel } from '@renderer/components/cowork/ArtifactsPanel'
import { ContextPanel } from '@renderer/components/cowork/ContextPanel'
import { SkillsPanel } from '@renderer/components/cowork/SkillsPanel'
import { cn } from '@renderer/lib/utils'

const tabs: { value: RightPanelTab; label: string; icon: React.ReactNode }[] = [
  { value: 'steps', label: 'Steps', icon: <ListChecks className="size-4" /> },
  { value: 'artifacts', label: 'Artifacts', icon: <FileOutput className="size-4" /> },
  { value: 'context', label: 'Context', icon: <Database className="size-4" /> },
  { value: 'skills', label: 'Skills', icon: <Sparkles className="size-4" /> },
]

export function RightPanel(): React.JSX.Element {
  const tab = useUIStore((s) => s.rightPanelTab)
  const setTab = useUIStore((s) => s.setRightPanelTab)

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l bg-background">
      {/* Tab Bar */}
      <div className="flex h-12 items-center gap-1 px-2">
        {tabs.map((t) => (
          <Button
            key={t.value}
            variant={tab === t.value ? 'secondary' : 'ghost'}
            size="sm"
            className={cn(
              'h-7 gap-1.5 px-2 text-xs',
              tab === t.value && 'bg-muted shadow-sm'
            )}
            onClick={() => setTab(t.value)}
          >
            {t.icon}
            <span className="hidden lg:inline">{t.label}</span>
          </Button>
        ))}
      </div>
      <Separator />

      {/* Panel Content */}
      <div className="flex-1 overflow-auto p-3">
        {tab === 'steps' && <StepsPanel />}
        {tab === 'artifacts' && <ArtifactsPanel />}
        {tab === 'context' && <ContextPanel />}
        {tab === 'skills' && <SkillsPanel />}
      </div>
    </aside>
  )
}
