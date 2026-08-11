import { Circle, HardDrive, LogOut, Plus, Radio, Terminal, User, Wifi, WifiOff } from 'lucide-react'
import type { SessionSummary } from '../types/api'
import { relativeTime } from '../lib/format'
import { useAuth } from '../lib/auth'
import { useWs } from '../lib/ws'

type Props = {
  sessions: SessionSummary[]
  activeId: string | null
  onSelect: (id: string) => void
  onNewSession: () => void
}

export function Sidebar({ sessions, activeId, onSelect, onNewSession }: Props) {
  const { logout, username } = useAuth()
  const { connected } = useWs()

  return (
    <aside className="flex h-full w-72 flex-col border-r border-base-800 bg-base-900">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/15 text-accent-400">
          <Terminal size={16} />
        </div>
        <span className="text-sm font-semibold text-base-50">claude-remote</span>
        <span className="ml-auto" title={connected ? 'Connected' : 'Reconnecting…'}>
          {connected ? (
            <Wifi size={14} className="text-good-500" />
          ) : (
            <WifiOff size={14} className="animate-pulse text-bad-500" />
          )}
        </span>
      </div>

      <div className="px-3">
        <button
          onClick={onNewSession}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-base-700 bg-base-850 py-2 text-sm font-medium text-base-100 transition hover:border-accent-500/50 hover:text-accent-400"
        >
          <Plus size={15} />
          New session
        </button>
      </div>

      <div className="mt-3 flex-1 overflow-y-auto px-2">
        {sessions.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-base-500">No sessions yet.</p>
        )}
        <ul className="space-y-1">
          {sessions.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => onSelect(s.id)}
                className={`w-full rounded-lg px-3 py-2.5 text-left transition ${
                  s.id === activeId ? 'bg-accent-500/10 ring-1 ring-accent-500/40' : 'hover:bg-base-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-base-100">{s.name}</span>
                  <Circle
                    size={7}
                    className={
                      s.status === 'running'
                        ? 'animate-pulse fill-good-500 text-good-500'
                        : 'fill-base-600 text-base-600'
                    }
                  />
                </div>
                <p className="mt-0.5 flex items-center gap-1 truncate font-mono text-xs text-base-500">
                  {s.target.type === 'runner' ? (
                    <Radio size={10} className="shrink-0 text-good-500" />
                  ) : (
                    <HardDrive size={10} className="shrink-0" />
                  )}
                  <span className="truncate">{s.cwd || '~'}</span>
                </p>
                {s.lastPrompt && <p className="mt-1 truncate text-xs text-base-400">{s.lastPrompt}</p>}
                <p className="mt-1 text-[11px] text-base-600">{relativeTime(s.updatedAt)}</p>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-base-800 p-3">
        {username && (
          <p className="mb-1 flex items-center gap-1.5 px-3 text-xs text-base-500">
            <User size={12} />
            {username}
          </p>
        )}
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-base-400 transition hover:bg-base-800 hover:text-base-100"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
