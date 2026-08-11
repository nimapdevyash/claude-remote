import fs from 'fs'
import os from 'os'
import path from 'path'

const MAP_PATH = path.join(os.homedir(), '.claude-remote', 'chat-session.json')

function loadSavedId() {
  try {
    return JSON.parse(fs.readFileSync(MAP_PATH, 'utf-8')).sessionId || null
  } catch {
    return null
  }
}

function saveId(sessionId) {
  fs.mkdirSync(path.dirname(MAP_PATH), { recursive: true })
  fs.writeFileSync(MAP_PATH, JSON.stringify({ sessionId }, null, 2))
}

async function authedFetch(httpBaseUrl, token, path, options = {}) {
  const res = await fetch(`${httpBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })
  return res
}

// Reuses the same chat session across CLI restarts (so `claude-remote`
// feels like resuming a conversation, not starting fresh every time) by
// remembering the session id locally and re-validating it still exists.
export async function ensureChatSession(httpBaseUrl, token, runnerId, name) {
  const saved = loadSavedId()
  if (saved) {
    const res = await authedFetch(httpBaseUrl, token, `/api/sessions/${saved}`)
    if (res.ok) return saved
  }

  const res = await authedFetch(httpBaseUrl, token, '/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ cwd: '', runnerId, name: `${name} (cli)` }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Could not create a chat session')
  }
  const session = await res.json()
  saveId(session.id)
  return session.id
}
