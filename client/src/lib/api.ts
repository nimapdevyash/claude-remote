import type { AccountInfo, BrowseResult, RunnerInfo, SessionDetail, SessionSummary } from '../types/api'

const TOKEN_KEY = 'claude-remote:token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })
  if (res.status === 401) {
    window.dispatchEvent(new Event('claude-remote:unauthorized'))
  }
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      message = body.error || message
    } catch {
      // ignore non-JSON error bodies
    }
    throw new ApiError(res.status, message)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  async login(username: string, password: string): Promise<{ token: string; username: string }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const body = await res.json()
    if (!res.ok) throw new ApiError(res.status, body.error || 'Login failed')
    return body
  },
  logout() {
    return request<void>('/auth/logout', { method: 'POST' })
  },
  me() {
    return request<{ username: string; isAdmin: boolean }>('/auth/me')
  },
  listSessions() {
    return request<SessionSummary[]>('/sessions')
  },
  createSession(payload: { name?: string; cwd: string; permissionMode?: string; model?: string; runnerId?: string }) {
    return request<SessionSummary>('/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  getSession(id: string) {
    return request<SessionDetail>(`/sessions/${id}`)
  },
  deleteSession(id: string) {
    return request<void>(`/sessions/${id}`, { method: 'DELETE' })
  },
  sendMessage(id: string, prompt: string) {
    return request<{ turnId: string }>(`/sessions/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    })
  },
  async uploadFile(id: string, file: File): Promise<{ path: string }> {
    const token = getToken()
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`/api/sessions/${id}/uploads`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new ApiError(res.status, body.error || 'Upload failed')
    }
    return res.json()
  },
  stopTurn(id: string) {
    return request<{ ok: true }>(`/sessions/${id}/stop`, { method: 'POST' })
  },
  browseFs(path: string) {
    return request<BrowseResult>(`/fs/browse?path=${encodeURIComponent(path)}`)
  },
  listRunners() {
    return request<RunnerInfo[]>('/runners')
  },
  browseRunnerFs(runnerId: string, path: string) {
    return request<BrowseResult>(`/runners/${runnerId}/browse?path=${encodeURIComponent(path)}`)
  },
  adminListAccounts() {
    return request<AccountInfo[]>('/admin/accounts')
  },
  adminCreateAccount(payload: { username: string; password: string; isAdmin?: boolean }) {
    return request<AccountInfo>('/admin/accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  adminRemoveAccount(username: string) {
    return request<void>(`/admin/accounts/${encodeURIComponent(username)}`, { method: 'DELETE' })
  },
}
