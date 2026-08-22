import fs from 'fs'
import path from 'path'
import { Router } from 'express'
import multer from 'multer'
import { nanoid } from 'nanoid'
import { store } from '../store.js'
import { config } from '../config.js'
import { resolveWorkspacePath } from '../paths.js'
import { runClaudeTurn } from '../claudeRunner.js'
import { wsHub } from '../wsHub.js'
import { runnerHub } from '../runnerHub.js'

export const sessionsRouter = Router()

const runningProcesses = new Map() // sessionId -> child process

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } })

// multer's own error path (oversized file, malformed multipart body) would
// otherwise fall through to express's default HTML error page — surface it
// as the same JSON shape every other route uses instead.
function uploadSingle(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message })
    next()
  })
}

function sanitizeFilename(name) {
  const cleaned = path.basename(String(name || 'file')).replace(/[^a-zA-Z0-9._-]/g, '_')
  return cleaned || 'file'
}

function summarize(session) {
  const lastTurn = session.turns[session.turns.length - 1]
  return {
    id: session.id,
    name: session.name,
    cwd: session.cwd,
    target: session.target,
    model: session.model,
    permissionMode: session.permissionMode,
    status: session.status,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastPrompt: lastTurn?.prompt ?? null,
    turnCount: session.turns.length,
  }
}

sessionsRouter.get('/', (req, res) => {
  res.json(store.listSessions().map(summarize))
})

sessionsRouter.post('/', (req, res) => {
  const { name, cwd, permissionMode, model, runnerId } = req.body || {}
  if (typeof cwd !== 'string') {
    return res.status(400).json({ error: 'cwd is required' })
  }

  let target
  let displayName

  if (runnerId) {
    if (!runnerHub.isConnected(runnerId)) {
      return res.status(400).json({ error: 'That runner is not currently connected' })
    }
    target = { type: 'runner', runnerId }
    displayName = cwd.split('/').filter(Boolean).pop() || 'session'
  } else {
    let abs
    try {
      abs = resolveWorkspacePath(cwd)
    } catch {
      return res.status(400).json({ error: 'cwd escapes workspace root' })
    }
    target = { type: 'local' }
    displayName = path.basename(abs) || 'session'
  }

  const session = {
    id: nanoid(10),
    name: name?.trim() || displayName,
    cwd,
    target,
    claudeSessionId: null,
    permissionMode: permissionMode || config.defaultPermissionMode,
    model: model || config.defaultModel,
    status: 'idle',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    turns: [],
  }
  store.createSession(session)
  res.status(201).json(summarize(session))
})

sessionsRouter.get('/:id', (req, res) => {
  const session = store.getSession(req.params.id)
  if (!session) return res.status(404).json({ error: 'Not found' })
  res.json(session)
})

// Saves an uploaded file next to the session's target filesystem (never the
// browser's) so a later turn can Read it by path. Files land in a dedicated
// .highwayman-uploads/<sessionId>/ folder — not the session's own cwd —
// so a drag-and-dropped screenshot never lands inside the user's own project.
sessionsRouter.post('/:id/uploads', uploadSingle, async (req, res) => {
  const session = store.getSession(req.params.id)
  if (!session) return res.status(404).json({ error: 'Not found' })
  if (!req.file) return res.status(400).json({ error: 'file is required' })

  const safeName = sanitizeFilename(req.file.originalname)
  const relPath = path.posix.join('.highwayman-uploads', session.id, `${nanoid(8)}-${safeName}`)
  const target = session.target || { type: 'local' }

  try {
    if (target.type === 'runner') {
      if (!runnerHub.isConnected(target.runnerId)) {
        return res.status(409).json({ error: 'Runner is not connected' })
      }
      await runnerHub.sendRequest(target.runnerId, 'write_file', {
        path: relPath,
        content: req.file.buffer.toString('base64'),
        encoding: 'base64',
      })
      return res.json({ path: relPath })
    }

    const abs = resolveWorkspacePath(relPath)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, req.file.buffer)
    res.json({ path: abs })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

sessionsRouter.delete('/:id', (req, res) => {
  const session = store.getSession(req.params.id)
  if (!session) return res.status(404).json({ error: 'Not found' })
  const proc = runningProcesses.get(session.id)
  if (proc) proc.kill('SIGTERM')
  store.deleteSession(session.id)
  res.status(204).end()
})

sessionsRouter.post('/:id/messages', (req, res) => {
  const session = store.getSession(req.params.id)
  if (!session) return res.status(404).json({ error: 'Not found' })
  if (session.status === 'running') {
    return res.status(409).json({ error: 'Session is busy' })
  }

  const prompt = (req.body?.prompt || '').trim()
  if (!prompt) return res.status(400).json({ error: 'prompt is required' })

  const target = session.target || { type: 'local' }
  if (target.type === 'runner' && !runnerHub.isConnected(target.runnerId)) {
    return res.status(409).json({ error: 'Runner is not connected' })
  }

  const turn = {
    id: nanoid(10),
    prompt,
    createdAt: Date.now(),
    status: 'running',
    exitCode: null,
    stderr: null,
    events: [],
    result: null,
  }
  store.addTurn(session.id, turn)
  store.updateSession(session.id, { status: 'running' })
  wsHub.broadcast(session.id, { type: 'turn_started', sessionId: session.id, turnId: turn.id, prompt })

  const turnCwd = target.type === 'runner' ? session.cwd : resolveWorkspacePath(session.cwd)

  const child = runClaudeTurn({
    cwd: turnCwd,
    prompt,
    resumeSessionId: session.claudeSessionId,
    permissionMode: session.permissionMode,
    model: session.model,
    target,
    onEvent: (event) => {
      store.appendTurnEvent(session.id, turn.id, event)
      if (event.type === 'system' && event.subtype === 'init' && event.session_id) {
        store.updateSession(session.id, { claudeSessionId: event.session_id })
      }
      if (event.type === 'result') {
        store.updateTurn(session.id, turn.id, { result: event })
      }
      wsHub.broadcast(session.id, {
        type: 'claude_event',
        sessionId: session.id,
        turnId: turn.id,
        event,
      })
    },
    onExit: (code, stderr) => {
      runningProcesses.delete(session.id)
      const status = code === 0 ? 'completed' : 'failed'
      store.updateTurn(session.id, turn.id, { status, exitCode: code, stderr })
      store.updateSession(session.id, { status: 'idle' })
      wsHub.broadcast(session.id, {
        type: 'turn_finished',
        sessionId: session.id,
        turnId: turn.id,
        status,
        exitCode: code,
        stderr,
      })
    },
  })

  runningProcesses.set(session.id, child)
  res.status(202).json({ turnId: turn.id })
})

sessionsRouter.post('/:id/stop', (req, res) => {
  const session = store.getSession(req.params.id)
  if (!session) return res.status(404).json({ error: 'Not found' })
  const proc = runningProcesses.get(session.id)
  if (!proc) return res.status(409).json({ error: 'No running task' })
  proc.kill('SIGINT')
  res.json({ ok: true })
})
