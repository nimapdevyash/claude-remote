import { useCallback, useEffect, useState } from 'react'
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
    <div className="flex h-screen bg-base-950">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={(id) => {
          setActiveId(id)
          refreshSessions()
        }}
        onNewSession={() => setModalOpen(true)}
      />
      {activeId ? (
        <ChatView key={activeId} sessionId={activeId} onActivity={refreshSessions} />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-base-500">
          Create a session to get started.
        </div>
      )}
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
