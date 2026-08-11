import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import dotenv from 'dotenv'
import { prompt } from './prompt.js'
import { printHeader } from './renderer.js'

dotenv.config()

const STATE_DIR = path.join(os.homedir(), '.claude-remote')
const ID_PATH = path.join(STATE_DIR, 'id')
const SETUP_PATH = path.join(STATE_DIR, 'config.json')

function ensureRunnerId() {
  try {
    const existing = fs.readFileSync(ID_PATH, 'utf-8').trim()
    if (existing) return existing
  } catch {
    // fall through to generating a new one
  }
  const id = crypto.randomUUID()
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true })
    fs.writeFileSync(ID_PATH, id)
  } catch {
    // non-fatal: this run just won't persist its id
  }
  return id
}

function loadSetup() {
  try {
    return JSON.parse(fs.readFileSync(SETUP_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

function saveSetup(setup) {
  fs.mkdirSync(STATE_DIR, { recursive: true })
  fs.writeFileSync(SETUP_PATH, JSON.stringify(setup, null, 2))
}

function toHttpBaseUrl(serverUrl) {
  return serverUrl.replace(/^ws/, 'http').replace(/\/ws\/?$/, '')
}

// Priority for the server URL: --server flag > SERVER_URL env var > saved
// config > interactive prompt. Only the prompted value is ever persisted —
// a flag or env var is meant to be a one-off override (e.g. a fresh ngrok
// URL) and shouldn't silently overwrite what's saved for next time.
export async function loadConfig({ serverOverride } = {}) {
  const saved = loadSetup()
  const { SERVER_URL, ROOT, NAME } = process.env
  let changed = false

  const overrideSource = serverOverride?.trim()
    ? '--server flag'
    : SERVER_URL?.trim()
      ? 'SERVER_URL env var'
      : null

  let serverUrl = serverOverride?.trim() || SERVER_URL?.trim() || saved.serverUrl
  if (!serverUrl) {
    printHeader('First-time setup')
    console.log('This only happens once — saved to ~/.claude-remote/config.json\n')
    serverUrl = await prompt('Server WebSocket URL [ws://localhost:4317/ws]: ')
    serverUrl = serverUrl || 'ws://localhost:4317/ws'
    changed = true
  }

  let root = ROOT?.trim() || saved.root
  if (!root) {
    const answer = await prompt(`Folder Claude Code may work in on this machine [${os.homedir()}]: `)
    root = answer || os.homedir()
    changed = true
  }
  root = path.resolve(root)

  let name = NAME?.trim() || saved.name
  if (!name) {
    const answer = await prompt(`Display name for this machine [${os.hostname()}]: `)
    name = answer || os.hostname()
    changed = true
  }

  if (changed) {
    saveSetup({ serverUrl, root, name })
    console.log('Saved. Run `claude-remote setup` any time to change these.\n')
  }

  return {
    serverUrl,
    httpBaseUrl: toHttpBaseUrl(serverUrl),
    root,
    name,
    runnerId: ensureRunnerId(),
    overrideSource,
  }
}

export function resetSetup() {
  try {
    fs.rmSync(SETUP_PATH)
  } catch {
    // already gone
  }
}
