import { Sparkles, Wrench } from 'lucide-react'
import { Badge } from '@renderer/components/ui/badge'
import { toolRegistry } from '@renderer/lib/agent/tool-registry'

export function SkillsPanel(): React.JSX.Element {
  const tools = toolRegistry.getDefinitions()

  if (tools.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Sparkles className="mb-3 size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No skills loaded</p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Installed plugin skills will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Built-in Tools
        </h4>
        <Badge variant="secondary" className="text-[10px]">
          {tools.length}
        </Badge>
      </div>
      <ul className="space-y-1">
        {tools.map((tool) => (
          <li
            key={tool.name}
            className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
          >
            <Wrench className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{tool.name}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {tool.description}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
