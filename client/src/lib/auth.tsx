import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { ApiError, api, clearToken, getToken, setToken as persistToken } from './api'

type AuthContextValue = {
  authed: boolean
  username: string | null
  error: string | null
  loggingIn: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(() => Boolean(getToken()))
  const [username, setUsername] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loggingIn, setLoggingIn] = useState(false)

  useEffect(() => {
    function handleUnauthorized() {
      clearToken()
      setAuthed(false)
      setUsername(null)
    }
    window.addEventListener('claude-remote:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('claude-remote:unauthorized', handleUnauthorized)
  }, [])

  useEffect(() => {
    if (authed && !username) {
      api
        .me()
        .then((res) => setUsername(res.username))
        .catch(() => {})
    }
  }, [authed, username])

  async function login(usernameInput: string, password: string) {
    setLoggingIn(true)
    setError(null)
    try {
      const res = await api.login(usernameInput, password)
      persistToken(res.token)
      setUsername(res.username)
      setAuthed(true)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not reach the server')
    } finally {
      setLoggingIn(false)
    }
  }

  function logout() {
    api.logout().catch(() => {})
    clearToken()
    setAuthed(false)
    setUsername(null)
  }

  return (
    <AuthContext.Provider value={{ authed, username, error, loggingIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
