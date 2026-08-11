import { Router } from 'express'
import { runnerHub } from '../runnerHub.js'

export const runnersRouter = Router()

runnersRouter.get('/', (req, res) => {
  res.json(runnerHub.list())
})

runnersRouter.get('/:id/browse', async (req, res) => {
  const path = req.query.path ? String(req.query.path) : ''
  try {
    const data = await runnerHub.sendRequest(req.params.id, 'list_dir', { path })
    res.json(data)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})
