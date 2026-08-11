import fs from 'fs'
import os from 'os'
import path from 'path'
import { prompt, promptHidden } from './prompt.js'

const TOKEN_PATH = path.join(os.homedir(), '.claude-remote-runner', 'session')

function loadCachedToken() {
  try {
    return fs.readFileSync(TOKEN_PATH, 'utf-8').trim() || null
  } catch {
    return null
  }
}

function saveToken(token) {
  fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true })
  fs.writeFileSync(TOKEN_PATH, token)
}

function clearToken() {
  try {
    fs.rmSync(TOKEN_PATH)
  } catch {
    // already gone
  }
}

async function verifyToken(httpBaseUrl, token) {
  try {
    const res = await fetch(`${httpBaseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.ok
  } catch {
    return false
  }
}

async function interactiveLogin(httpBaseUrl) {
  console.log(`\nSign in to ${httpBaseUrl}\n`)
  for (let attempt = 0; attempt < 5; attempt++) {
    const username = await prompt('Username: ')
    const password = await promptHidden('Password: ')
    try {
      const res = await fetch(`${httpBaseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const body = await res.json()
      if (res.ok) {
        saveToken(body.token)
        console.log(`Signed in as ${body.username}.\n`)
        return body.token
      }
      console.log(body.error || 'Login failed — try again.\n')
    } catch (err) {
      console.error(`Could not reach ${httpBaseUrl}: ${err.message}`)
      process.exit(1)
    }
  }
  console.error('Too many failed login attempts.')
  process.exit(1)
}

export async function ensureAuthToken(httpBaseUrl) {
  const cached = loadCachedToken()
  if (cached && (await verifyToken(httpBaseUrl, cached))) {
    return cached
  }
  if (cached) clearToken()
  return interactiveLogin(httpBaseUrl)
}

export { clearToken as clearCachedToken }
