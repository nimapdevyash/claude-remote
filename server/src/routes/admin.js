import { Router } from 'express'
import { accounts } from '../accounts.js'

// Mounted at /api/admin behind requireAuth + requireAdmin — every route
// here is only reachable by an account with isAdmin: true.
export const adminRouter = Router()

adminRouter.get('/accounts', (req, res) => {
  res.json(accounts.listWithRoles())
})

adminRouter.post('/accounts', (req, res) => {
  const { username, password, isAdmin } = req.body || {}
  if (typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ error: 'username is required' })
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' })
  }
  accounts.create(username.trim(), password, { isAdmin: Boolean(isAdmin) })
  res.status(201).json({ username: username.trim(), isAdmin: Boolean(isAdmin) })
})

adminRouter.delete('/accounts/:username', (req, res) => {
  const { username } = req.params
  if (username === req.username) {
    return res.status(400).json({ error: "You can't remove your own account while signed in as it" })
  }
  const removed = accounts.remove(username)
  if (!removed) return res.status(404).json({ error: 'No such account' })
  res.status(204).end()
})
