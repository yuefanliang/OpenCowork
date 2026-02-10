import { useEffect } from 'react'
import { SidebarProvider, SidebarInset } from '@renderer/components/ui/sidebar'
import { TooltipProvider } from '@renderer/components/ui/tooltip'
import { AppSidebar } from './AppSidebar'
import { TopBar } from './TopBar'
import { RightPanel } from './RightPanel'
import { MessageList } from '@renderer/components/chat/MessageList'
import { InputArea } from '@renderer/components/chat/InputArea'
import { SettingsDialog } from '@renderer/components/settings/SettingsDialog'
import { PermissionDialog } from '@renderer/components/cowork/PermissionDialog'
import { useUIStore } from '@renderer/stores/ui-store'
import { useChatStore } from '@renderer/stores/chat-store'
import { useAgentStore } from '@renderer/stores/agent-store'
import { useChatActions } from '@renderer/hooks/use-chat-actions'
import { ipcClient } from '@renderer/lib/ipc/ipc-client'

export function Layout(): React.JSX.Element {
  const mode = useUIStore((s) => s.mode)
  const leftSidebarOpen = useUIStore((s) => s.leftSidebarOpen)
  const setLeftSidebarOpen = useUIStore((s) => s.setLeftSidebarOpen)
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen)
  const sessions = useChatStore((s) => s.sessions)
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const streamingMessageId = useChatStore((s) => s.streamingMessageId)
  const pendingToolCalls = useAgentStore((s) => s.pendingToolCalls)
  const resolveApproval = useAgentStore((s) => s.resolveApproval)

  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const { sendMessage, stopStreaming, retryLastMessage } = useChatActions()

  // Update window title
  useEffect(() => {
    document.title = activeSession?.title
      ? `${activeSession.title} — OpenCowork`
      : 'OpenCowork'
  }, [activeSession?.title])

  const pendingApproval = pendingToolCalls[0] ?? null
  const createSession = useChatStore((s) => s.createSession)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const toggleLeftSidebar = useUIStore((s) => s.toggleLeftSidebar)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Ctrl+N: New chat
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        createSession(mode)
      }
      // Ctrl+,: Open settings
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        setSettingsOpen(true)
      }
      // Ctrl+B: Toggle left sidebar
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'b') {
        e.preventDefault()
        toggleLeftSidebar()
      }
      // Ctrl+Shift+B: Toggle right panel
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'B') {
        e.preventDefault()
        useUIStore.getState().toggleRightPanel()
      }
      // Ctrl+L: Clear current conversation
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault()
        if (activeSessionId) {
          useChatStore.getState().clearSessionMessages(activeSessionId)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, createSession, setSettingsOpen, toggleLeftSidebar, activeSessionId])

  const handleSelectFolder = async (): Promise<void> => {
    const result = (await ipcClient.invoke('fs:select-folder')) as { canceled?: boolean; path?: string }
    if (!result.canceled && result.path && activeSessionId) {
      useChatStore.getState().setWorkingFolder(activeSessionId, result.path)
    }
  }

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider open={leftSidebarOpen} onOpenChange={setLeftSidebarOpen}>
        <AppSidebar />
        <SidebarInset>
          <div className="flex h-screen flex-col">
            <TopBar />
            <div className="flex flex-1 overflow-hidden">
              {/* Center: Chat Area */}
              <div className="flex flex-1 flex-col">
                <MessageList onRetry={retryLastMessage} />
                <InputArea
                  onSend={sendMessage}
                  onStop={stopStreaming}
                  onSelectFolder={mode !== 'chat' ? handleSelectFolder : undefined}
                  workingFolder={activeSession?.workingFolder}
                  isStreaming={!!streamingMessageId}
                />
              </div>

              {/* Right: Cowork/Code Panel */}
              {mode !== 'chat' && rightPanelOpen && <RightPanel />}
            </div>
          </div>
        </SidebarInset>

        <SettingsDialog />
        <PermissionDialog
          toolCall={pendingApproval}
          onAllow={() => pendingApproval && resolveApproval(pendingApproval.id, true)}
          onDeny={() => pendingApproval && resolveApproval(pendingApproval.id, false)}
        />
      </SidebarProvider>
    </TooltipProvider>
  )
}
