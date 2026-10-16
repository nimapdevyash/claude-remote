import { useCallback, useEffect, useState } from 'react'
import { Menu } from 'lucide-react'
import { AuthProvider, useAuth } from './lib/auth'
import { WsProvider } from './lib/ws'
import { LoginScreen } from './components/LoginScreen'
import { Sidebar } from './components/Sidebar'
import { ChatView } from './components/ChatView'
import { NewSessionModal } from './components/NewSessionModal'
import { api } from './lib/api'
import type { SessionSummary } from './types/api'

function Shell() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 768,
  )

  const refreshSessions = useCallback(async () => {
    try {
      const list = await api.listSessions()
      setSessions(list)
      return list
    } catch {
      return []
    }
  }, [])

  useEffect(() => {
    refreshSessions().then((list) => {
      if (list.length > 0) setActiveId(list[0].id)
    })
  }, [refreshSessions])

  function handleCreated(id: string) {
    setModalOpen(false)
    refreshSessions()
    setActiveId(id)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-base-950">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        open={sidebarOpen}
        onSelect={(id) => {
          setActiveId(id)
          refreshSessions()
          if (window.innerWidth < 768) setSidebarOpen(false)
        }}
        onNewSession={() => setModalOpen(true)}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {activeId ? (
          <ChatView
            key={activeId}
            sessionId={activeId}
            onActivity={refreshSessions}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((o) => !o)}
          />
        ) : (
          <div className="flex h-full flex-col">
            <header className="flex items-center gap-2 border-b border-base-800 px-3 py-4 md:px-6">
              <button
                onClick={() => setSidebarOpen((o) => !o)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base-400 transition hover:bg-base-800 hover:text-base-100"
                title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              >
                <Menu size={16} />
              </button>
            </header>
            <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-base-500">
              Create a session to get started.
            </div>
          </div>
        )}
      </div>
      {modalOpen && <NewSessionModal onClose={() => setModalOpen(false)} onCreated={handleCreated} />}
    </div>
  )
}

function Gate() {
  const { authed } = useAuth()
  return authed ? (
    <WsProvider>
      <Shell />
    </WsProvider>
  ) : (
    <LoginScreen />
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
