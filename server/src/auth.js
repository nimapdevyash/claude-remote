import { authSessions } from './authSessions.js'
import { accounts } from './accounts.js'

// A "token" here is always a login session token issued by
// authSessions.create() after verifying username+password — never a
// static shared secret.
export function isValidToken(token) {
  return Boolean(authSessions.validate(token))
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  const username = authSessions.validate(token)
  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  req.username = username
  next()
}

// Must run after requireAuth (needs req.username already set).
export function requireAdmin(req, res, next) {
  if (!accounts.isAdmin(req.username)) {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}
