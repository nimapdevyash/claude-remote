import { Router } from 'express'
import { config } from '../config.js'
import { runnerHub } from '../runnerHub.js'

// Reachable only by the MCP bridge subprocesses this server spawns locally
// for runner-targeted sessions — never exposed to the browser. Guarded by a
// loopback check plus a per-boot internal token so a remote attacker who
// only has the browser AUTH_TOKEN still can't hit these directly.
export const internalRouter = Router()

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

internalRouter.use((req, res, next) => {
  const ip = req.socket.remoteAddress
  if (!LOOPBACK.has(ip)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  if (req.headers['x-internal-token'] !== config.internalToken) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
})

function forward(action) {
  return async (req, res) => {
    try {
      const data = await runnerHub.sendRequest(req.params.runnerId, action, req.body || {})
      res.json({ ok: true, data })
    } catch (err) {
      res.status(502).json({ ok: false, error: err.message })
    }
  }
}

internalRouter.post('/runner/:runnerId/exec', forward('exec'))
internalRouter.post('/runner/:runnerId/read', forward('read_file'))
internalRouter.post('/runner/:runnerId/write', forward('write_file'))
internalRouter.post('/runner/:runnerId/edit', forward('edit_file'))
internalRouter.post('/runner/:runnerId/list', forward('list_dir'))
