import { useEffect, useState } from 'react'
import { ChevronRight, Folder, FolderOpen, HardDrive, Radio, X } from 'lucide-react'
import { api } from '../lib/api'
import type { RunnerInfo } from '../types/api'

type Props = {
  onClose: () => void
  onCreated: (id: string) => void
}

const PERMISSION_MODES = ['acceptEdits', 'bypassPermissions', 'dontAsk', 'plan', 'manual', 'auto']

export function NewSessionModal({ onClose, onCreated }: Props) {
  const [runners, setRunners] = useState<RunnerInfo[]>([])
  const [runnerId, setRunnerId] = useState<string | null>(null)

  const [path, setPath] = useState('')
  const [dirs, setDirs] = useState<string[]>([])
  const [root, setRoot] = useState('')
  const [name, setName] = useState('')
  const [permissionMode, setPermissionMode] = useState('acceptEdits')
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listRunners().then(setRunners).catch(() => setRunners([]))
  }, [])

  async function load(p: string, targetRunnerId: string | null) {
    setLoading(true)
    setError(null)
    try {
      const res = targetRunnerId ? await api.browseRunnerFs(targetRunnerId, p) : await api.browseFs(p)
      setPath(res.path)
      setDirs(res.dirs)
      setRoot(res.root)
    } catch {
      setError('Could not browse that folder')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load('', runnerId)
  }, [runnerId])

  const segments = path ? path.split('/') : []

  async function handleCreate() {
    setCreating(true)
    setError(null)
    try {
      const session = await api.createSession({
        name: name || undefined,
        cwd: path,
        permissionMode,
        runnerId: runnerId || undefined,
      })
      onCreated(session.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create session')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-base-700 bg-base-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-base-800 px-5 py-4">
          <h2 className="text-sm font-semibold text-base-50">New session</h2>
          <button onClick={onClose} className="text-base-400 hover:text-base-100">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-base-400">Run on</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <button
                onClick={() => setRunnerId(null)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                  runnerId === null
                    ? 'border-accent-500/60 bg-accent-500/10 text-base-50'
                    : 'border-base-700 bg-base-850 text-base-300 hover:border-base-600'
                }`}
              >
                <HardDrive size={14} className="shrink-0" />
                <span className="truncate">This server</span>
              </button>
              {runners.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRunnerId(r.id)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                    runnerId === r.id
                      ? 'border-accent-500/60 bg-accent-500/10 text-base-50'
                      : 'border-base-700 bg-base-850 text-base-300 hover:border-base-600'
                  }`}
                >
                  <Radio size={14} className="shrink-0 text-good-500" />
                  <span className="truncate">{r.name}</span>
                </button>
              ))}
            </div>
            {runners.length === 0 && (
              <p className="mt-1.5 text-xs text-base-500">
                No runners connected. Start one with <code className="rounded bg-base-800 px-1 font-mono">npm run runner</code> on
                another machine to target it here.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-base-400">Workspace folder</label>
            <div className="mb-2 flex items-center gap-1 overflow-x-auto rounded-lg bg-base-850 px-2 py-1.5 text-xs text-base-400">
              <button
                onClick={() => load('', runnerId)}
                className="shrink-0 rounded px-1.5 py-0.5 hover:bg-base-800 hover:text-base-100"
              >
                {root.split('/').pop() || 'root'}
              </button>
              {segments.map((seg, i) => (
                <span key={i} className="flex items-center gap-1">
                  <ChevronRight size={12} />
                  <button
                    onClick={() => load(segments.slice(0, i + 1).join('/'), runnerId)}
                    className="shrink-0 rounded px-1.5 py-0.5 hover:bg-base-800 hover:text-base-100"
                  >
                    {seg}
                  </button>
                </span>
              ))}
            </div>
            <div className="h-48 overflow-y-auto rounded-lg border border-base-800">
              {loading ? (
                <p className="p-4 text-center text-xs text-base-500">Loading…</p>
              ) : dirs.length === 0 ? (
                <p className="p-4 text-center text-xs text-base-500">No subfolders here.</p>
              ) : (
                <ul className="divide-y divide-base-800">
                  {dirs.map((d) => (
                    <li key={d}>
                      <button
                        onClick={() => load(path ? `${path}/${d}` : d, runnerId)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-base-200 hover:bg-base-800"
                      >
                        <Folder size={14} className="text-accent-400" />
                        {d}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-base-500">
              <FolderOpen size={12} />
              Selected: <code className="rounded bg-base-800 px-1 font-mono text-base-300">{path || '.'}</code>
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-base-400">Session name (optional)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={path.split('/').pop() || 'session'}
              className="w-full rounded-lg border border-base-700 bg-base-850 px-3 py-2 text-sm text-base-100 outline-none focus:border-accent-500"
            />
          </div>

          {!runnerId && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-base-400">Permission mode</label>
              <select
                value={permissionMode}
                onChange={(e) => setPermissionMode(e.target.value)}
                className="w-full rounded-lg border border-base-700 bg-base-850 px-3 py-2 text-sm text-base-100 outline-none focus:border-accent-500"
              >
                {PERMISSION_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-sm text-bad-500">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-base-800 px-5 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-base-300 hover:bg-base-800">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-500 disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create session'}
          </button>
        </div>
      </div>
    </div>
  )
}
