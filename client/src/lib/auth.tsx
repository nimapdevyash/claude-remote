import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { ApiError, api, clearToken, getToken, setToken as persistToken } from './api'

type AuthContextValue = {
  authed: boolean
  username: string | null
  isAdmin: boolean
  error: string | null
  loggingIn: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(() => Boolean(getToken()))
  const [username, setUsername] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loggingIn, setLoggingIn] = useState(false)

  useEffect(() => {
    function handleUnauthorized() {
      clearToken()
      setAuthed(false)
      setUsername(null)
      setIsAdmin(false)
    }
    window.addEventListener('highwayman:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('highwayman:unauthorized', handleUnauthorized)
  }, [])

  useEffect(() => {
    if (authed && !username) {
      api
        .me()
        .then((res) => {
          setUsername(res.username)
          setIsAdmin(res.isAdmin)
        })
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
    setIsAdmin(false)
  }

  return (
    <AuthContext.Provider value={{ authed, username, isAdmin, error, loggingIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
