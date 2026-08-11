import fs from 'fs'
import path from 'path'
import http from 'http'
import { fileURLToPath } from 'url'
import express from 'express'
import { WebSocketServer } from 'ws'
import { config } from './config.js'
import { requireAuth, requireAdmin, isValidToken } from './auth.js'
import { accounts } from './accounts.js'
import { authSessions } from './authSessions.js'
import { sessionsRouter } from './routes/sessions.js'
import { fsRouter } from './routes/fs.js'
import { runnersRouter } from './routes/runners.js'
import { internalRouter } from './routes/internal.js'
import { adminRouter } from './routes/admin.js'
import { wsHub } from './wsHub.js'
import { runnerHub } from './runnerHub.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
app.use(express.json({ limit: '2mb' }))

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {}
  if (!accounts.hasAny()) {
    return res.status(400).json({ error: 'No accounts configured yet — run `npm run create-account -w server`.' })
  }
  if (typeof username !== 'string' || typeof password !== 'string' || !accounts.verify(username, password)) {
    return res.status(401).json({ error: 'Invalid username or password' })
  }
  const token = authSessions.create(username)
  res.json({ token, username })
})

app.post('/api/auth/logout', requireAuth, (req, res) => {
  const header = req.headers.authorization || ''
  authSessions.revoke(header.slice(7))
  res.status(204).end()
})

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ username: req.username, isAdmin: accounts.isAdmin(req.username) })
})

app.get('/api/workspace', requireAuth, (req, res) => {
  res.json({ root: config.workspaceRoot })
})

app.use('/api/sessions', requireAuth, sessionsRouter)
app.use('/api/fs', requireAuth, fsRouter)
app.use('/api/runners', requireAuth, runnersRouter)
app.use('/api/admin', requireAuth, requireAdmin, adminRouter)
app.use('/internal', internalRouter)

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist')
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get(/^\/(?!api|ws).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
} else {
  app.get('/', (req, res) => {
    res.send('claude-remote API server is running. Start the client with `npm run dev -w client`.')
  })
}

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost')
  const token = url.searchParams.get('token')
  if (!isValidToken(token)) {
    ws.close(4401, 'unauthorized')
    return
  }

  if (url.searchParams.get('role') === 'runner') {
    const runnerId = url.searchParams.get('runnerId')
    const name = url.searchParams.get('name') || 'runner'
    if (!runnerId) {
      ws.close(4400, 'missing runnerId')
      return
    }

    runnerHub.register(runnerId, name, ws)
    console.log(`  Runner connected: ${name} (${runnerId})`)

    ws.on('message', (raw) => {
      let msg
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }
      if (msg.type === 'response') runnerHub.handleResponse(msg)
    })

    ws.on('close', () => {
      runnerHub.unregister(runnerId, ws)
      console.log(`  Runner disconnected: ${name} (${runnerId})`)
    })
    return
  }

  let currentSessionId = null

  ws.on('message', (raw) => {
    let msg
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }
    if (msg.type === 'subscribe' && msg.sessionId) {
      if (currentSessionId) wsHub.leave(currentSessionId, ws)
      currentSessionId = msg.sessionId
      wsHub.join(currentSessionId, ws)
    }
  })

  ws.on('close', () => {
    wsHub.leaveAll(ws)
  })
})

server.listen(config.port, () => {
  console.log(`\n  claude-remote server listening on http://localhost:${config.port}\n`)
  console.log(`  Workspace root: ${config.workspaceRoot}\n`)

  // `npm run dev` (scripts/dev.js) prints its own unified banner — ngrok
  // URL, CLI install one-liner, connect command — and deliberately leaves
  // credentials out of it, so skip printing them here too.
  if (process.env.CLAUDE_REMOTE_SUPPRESS_CREDENTIALS) return

  const creds = accounts.envCredentials()
  const roles = accounts.listWithRoles()
  const label = ({ username, isAdmin }) => (isAdmin ? `${username} (admin)` : username)

  if (creds) {
    console.log('  Sign in with:')
    console.log(`    username: ${creds.username}`)
    console.log(`    password: ${creds.password}`)
    const others = roles.filter((a) => a.username !== creds.username)
    if (others.length > 0) {
      console.log(`  Other accounts (password not shown): ${others.map(label).join(', ')}`)
    }
    console.log()
  } else if (roles.length > 0) {
    console.log(`  Accounts (password not shown): ${roles.map(label).join(', ')}`)
    console.log('  (set ADMIN_USERNAME/ADMIN_PASSWORD in server/.env to have one printed here)\n')
  } else {
    console.log('  No accounts configured yet — run `npm run create-account -w server`\n')
  }
})
