import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', 'data', 'db.json')

function load() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'))
  } catch {
    return { sessions: {} }
  }
}

const db = load()
let saveTimer = null

function schedulePersist() {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
  }, 150)
}

export const store = {
  listSessions() {
    return Object.values(db.sessions).sort((a, b) => b.updatedAt - a.updatedAt)
  },
  getSession(id) {
    return db.sessions[id] || null
  },
  createSession(session) {
    db.sessions[session.id] = session
    schedulePersist()
    return session
  },
  updateSession(id, patch) {
    const session = db.sessions[id]
    if (!session) return null
    Object.assign(session, patch, { updatedAt: Date.now() })
    schedulePersist()
    return session
  },
  deleteSession(id) {
    delete db.sessions[id]
    schedulePersist()
  },
  addTurn(sessionId, turn) {
    const session = db.sessions[sessionId]
    if (!session) return null
    session.turns.push(turn)
    session.updatedAt = Date.now()
    schedulePersist()
    return turn
  },
  getTurn(sessionId, turnId) {
    const session = db.sessions[sessionId]
    return session?.turns.find((t) => t.id === turnId) || null
  },
  updateTurn(sessionId, turnId, patch) {
    const turn = store.getTurn(sessionId, turnId)
    if (!turn) return null
    Object.assign(turn, patch)
    schedulePersist()
    return turn
  },
  appendTurnEvent(sessionId, turnId, event) {
    const turn = store.getTurn(sessionId, turnId)
    if (!turn) return
    turn.events.push(event)
    schedulePersist()
  },
}
