import { useEffect, useState } from 'react'
import { ShieldCheck, Trash2, UserPlus, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import type { AccountInfo } from '../types/api'
import { useAuth } from '../lib/auth'

type Props = {
  onClose: () => void
}

export function AdminPanel({ onClose }: Props) {
  const { username: currentUsername } = useAuth()
  const [accounts, setAccounts] = useState<AccountInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newIsAdmin, setNewIsAdmin] = useState(false)
  const [creating, setCreating] = useState(false)

  function refresh() {
    setLoading(true)
    api
      .adminListAccounts()
      .then(setAccounts)
      .catch(() => setError('Could not load accounts'))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [])

  async function handleCreate() {
    setError(null)
    setCreating(true)
    try {
      await api.adminCreateAccount({ username: newUsername.trim(), password: newPassword, isAdmin: newIsAdmin })
      setNewUsername('')
      setNewPassword('')
      setNewIsAdmin(false)
      refresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to create account')
    } finally {
      setCreating(false)
    }
  }

  async function handleRemove(username: string) {
    setError(null)
    try {
      await api.adminRemoveAccount(username)
      refresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to remove account')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-base-700 bg-base-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-base-800 px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-base-50">
            <ShieldCheck size={15} className="text-accent-400" />
            Manage accounts
          </h2>
          <button onClick={onClose} className="text-base-400 hover:text-base-100">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-64 overflow-y-auto px-5 py-3">
          {loading ? (
            <p className="py-4 text-center text-xs text-base-500">Loading…</p>
          ) : accounts.length === 0 ? (
            <p className="py-4 text-center text-xs text-base-500">No accounts.</p>
          ) : (
            <ul className="space-y-1">
              {accounts.map((a) => (
                <li key={a.username} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-base-800">
                  <span className="flex items-center gap-2 text-sm text-base-100">
                    {a.username}
                    {a.isAdmin && (
                      <span className="rounded-full bg-accent-500/15 px-2 py-0.5 text-[10px] font-medium text-accent-400">
                        admin
                      </span>
                    )}
                    {a.username === currentUsername && <span className="text-[10px] text-base-500">(you)</span>}
                  </span>
                  {a.username !== currentUsername && (
                    <button
                      onClick={() => handleRemove(a.username)}
                      className="text-base-500 hover:text-bad-500"
                      title="Remove account"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2 border-t border-base-800 px-5 py-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-base-400">
            <UserPlus size={13} />
            Add account
          </p>
          <input
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="Username"
            className="w-full rounded-lg border border-base-700 bg-base-850 px-3 py-2 text-sm text-base-100 outline-none focus:border-accent-500"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Password (min 8 characters)"
            className="w-full rounded-lg border border-base-700 bg-base-850 px-3 py-2 text-sm text-base-100 outline-none focus:border-accent-500"
          />
          <label className="flex items-center gap-2 text-xs text-base-400">
            <input type="checkbox" checked={newIsAdmin} onChange={(e) => setNewIsAdmin(e.target.checked)} />
            Grant admin access
          </label>
          {error && <p className="text-sm text-bad-500">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={creating || !newUsername.trim() || newPassword.length < 8}
            className="w-full rounded-lg bg-accent-600 py-2 text-sm font-medium text-white hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create account'}
          </button>
        </div>
      </div>
    </div>
  )
}
