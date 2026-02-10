import { Plus, MessageSquare, Trash2 } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@renderer/components/ui/sidebar'
import { Button } from '@renderer/components/ui/button'
import { useChatStore } from '@renderer/stores/chat-store'
import { useUIStore } from '@renderer/stores/ui-store'

export function AppSidebar(): React.JSX.Element {
  const sessions = useChatStore((s) => s.sessions)
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const createSession = useChatStore((s) => s.createSession)
  const deleteSession = useChatStore((s) => s.deleteSession)
  const setActiveSession = useChatStore((s) => s.setActiveSession)
  const mode = useUIStore((s) => s.mode)

  const handleNewSession = (): void => {
    createSession(mode)
  }

  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
            OC
          </div>
          <span className="text-sm font-semibold group-data-[collapsible=icon]:hidden">
            OpenCowork
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Conversations</SidebarGroupLabel>
          <SidebarGroupAction onClick={handleNewSession} title="New conversation">
            <Plus className="size-4" />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {sessions.length === 0 ? (
                <div className="px-2 py-4 text-center text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                  No conversations yet
                </div>
              ) : (
                sessions
                  .slice()
                  .sort((a, b) => b.updatedAt - a.updatedAt)
                  .map((session) => (
                    <SidebarMenuItem key={session.id}>
                      <SidebarMenuButton
                        isActive={session.id === activeSessionId}
                        onClick={() => setActiveSession(session.id)}
                        tooltip={session.title}
                      >
                        <MessageSquare className="size-4" />
                        <span>{session.title}</span>
                      </SidebarMenuButton>
                      <SidebarMenuAction
                        showOnHover
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteSession(session.id)
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </SidebarMenuAction>
                    </SidebarMenuItem>
                  ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
          onClick={handleNewSession}
        >
          <Plus className="size-4" />
          <span className="group-data-[collapsible=icon]:hidden">New Chat</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  )
}
