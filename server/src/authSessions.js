import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SESSIONS_PATH = path.join(__dirname, '..', 'data', 'authSessions.json')
const TTL_MS = 30 * 24 * 60 * 60 * 1000

function load() {
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

const sessions = load()
let saveTimer = null

function schedulePersist() {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    fs.mkdirSync(path.dirname(SESSIONS_PATH), { recursive: true })
    fs.writeFileSync(SESSIONS_PATH, JSON.stringify(sessions, null, 2))
  }, 150)
}

// Login sessions issued after verifying username+password — this is the
// token everything else (REST, WS) checks, not a static shared secret.
export const authSessions = {
  create(username) {
    const token = crypto.randomBytes(32).toString('hex')
    sessions[token] = { username, createdAt: Date.now(), expiresAt: Date.now() + TTL_MS }
    schedulePersist()
    return token
  },
  validate(token) {
    const entry = token && sessions[token]
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      delete sessions[token]
      schedulePersist()
      return null
    }
    return entry.username
  },
  revoke(token) {
    if (sessions[token]) {
      delete sessions[token]
      schedulePersist()
    }
  },
}
