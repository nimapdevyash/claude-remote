import { useState, type FormEvent } from 'react'
import { Lock, Terminal, User } from 'lucide-react'
import { useAuth } from '../lib/auth'

export function LoginScreen() {
  const { login, error, loggingIn } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (username.trim() && password) login(username.trim(), password)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="glow-ring flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-500/15 text-accent-400">
            <Terminal size={22} />
          </div>
          <h1 className="text-xl font-semibold text-base-50">claude-remote</h1>
          <p className="text-sm text-base-400">Sign in to connect to the server.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-400" />
            <input
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full rounded-xl border border-base-700 bg-base-900 py-2.5 pl-9 pr-3 text-sm text-base-100 outline-none transition focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30"
            />
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-400" />
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-xl border border-base-700 bg-base-900 py-2.5 pl-9 pr-3 text-sm text-base-100 outline-none transition focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30"
            />
          </div>
          {error && <p className="text-sm text-bad-500">{error}</p>}
          <button
            type="submit"
            disabled={loggingIn || !username.trim() || !password}
            className="w-full rounded-xl bg-accent-600 py-2.5 text-sm font-medium text-white transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loggingIn ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-base-500">
          No account yet? Run{' '}
          <code className="rounded bg-base-800 px-1 py-0.5 font-mono">npm run create-account -w server</code> on the
          server.
        </p>
      </div>
    </div>
  )
}
