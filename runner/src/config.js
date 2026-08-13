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

// The server URL is deliberately NEVER saved/reused — it's typically an
// ngrok-style tunnel URL that changes basically every time the server is
// restarted, so a cached "default" would just go stale and silently point
// at a dead tunnel. Every run takes it fresh: --server flag > SERVER_URL
// env var > interactive prompt (looped until non-empty — no fallback
// default to silently fall back on here either).
//
// Folder and display name are the opposite: they describe this machine
// itself and don't change run to run, so those still get asked once and
// persisted to ~/.claude-remote/config.json.
//
// `minimal: true` (used by `admin` subcommands) skips the root/name
// prompts entirely — those describe this machine's executor, which admin
// commands never start.
export async function loadConfig({ serverOverride, minimal = false } = {}) {
  const saved = loadSetup()
  const { SERVER_URL, ROOT, NAME } = process.env
  let changed = false

  const overrideSource = serverOverride?.trim()
    ? '--server flag'
    : SERVER_URL?.trim()
      ? 'SERVER_URL env var'
      : null

  let serverUrl = serverOverride?.trim() || SERVER_URL?.trim() || ''
  while (!serverUrl) {
    serverUrl = (await prompt('Server WebSocket URL: ')).trim()
  }

  let root = ROOT?.trim() || saved.root
  let name = NAME?.trim() || saved.name

  if (!minimal) {
    if (!root || !name) {
      printHeader('First-time setup')
      console.log('Folder and display name only need to be set once — saved to ~/.claude-remote/config.json\n')
    }

    if (!root) {
      const answer = await prompt(`Folder Claude Code may work in on this machine [${os.homedir()}]: `)
      root = answer || os.homedir()
      changed = true
    }
    root = path.resolve(root)

    if (!name) {
      const answer = await prompt(`Display name for this machine [${os.hostname()}]: `)
      name = answer || os.hostname()
      changed = true
    }
  }

  if (changed) {
    saveSetup({ root, name })
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
