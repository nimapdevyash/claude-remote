import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import dotenv from 'dotenv'
import { prompt } from './prompt.js'
import { printHeader, dim } from './renderer.js'

dotenv.config()

const STATE_DIR = path.join(os.homedir(), '.highwayman')
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

// The server URL is a frequent trap: it's often an ngrok-style tunnel URL
// that changes on restart, so blindly caching it (the old behavior) meant
// silently pointing at a dead tunnel until you remembered `--server`. But
// never caching it at all meant retyping a *stable* local URL every single
// run, which is its own annoyance. So: it IS cached, but every run that
// isn't given an explicit override asks a single yes/no question — "want a
// different server this time?" — defaulting to "no" (reuse what's saved).
// Priority: --server flag > SERVER_URL env var > that y/n prompt.
//
// Folder and display name are simpler: they describe this machine itself
// and don't change run to run, so those just get asked once and persisted
// to ~/.highwayman/config.json, no confirmation dance needed.
//
// `minimal: true` (used by `admin` subcommands) skips the root/name
// prompts entirely — those describe this machine's executor, which admin
// commands never start.
export async function loadConfig({ serverOverride, minimal = false } = {}) {
  const saved = loadSetup()
  const { SERVER_URL, ROOT, NAME } = process.env
  let changed = false
  // Tracks whether serverUrl was actually typed in this run (fresh entry or
  // switching away from the saved one) — as opposed to reused from saved or
  // supplied via a one-off --server/SERVER_URL override. Only a typed value
  // ever gets written back to config.json; an override is deliberately a
  // single-run thing and must never clobber the saved default.
  let serverUrlChanged = false

  const overrideSource = serverOverride?.trim()
    ? '--server flag'
    : SERVER_URL?.trim()
      ? 'SERVER_URL env var'
      : null

  let serverUrl = serverOverride?.trim() || SERVER_URL?.trim() || ''
  if (!serverUrl && saved.serverUrl) {
    console.log(dim(`Saved server: ${saved.serverUrl}`))
    const answer = (await prompt('Connect to a different one this run? [y/N] ')).trim().toLowerCase()
    if (answer === 'y' || answer === 'yes') {
      while (!serverUrl) serverUrl = (await prompt('Server WebSocket URL: ')).trim()
      serverUrlChanged = true
    } else {
      serverUrl = saved.serverUrl
    }
  }
  while (!serverUrl) {
    serverUrl = (await prompt('Server WebSocket URL: ')).trim()
    serverUrlChanged = true
  }

  let root = ROOT?.trim() || saved.root
  let name = NAME?.trim() || saved.name

  if (!minimal) {
    if (!root || !name) {
      printHeader('First-time setup')
      console.log('Folder and display name only need to be set once — saved to ~/.highwayman/config.json\n')
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

  if (changed || serverUrlChanged) {
    const setupToSave = { root, name }
    if (serverUrlChanged) setupToSave.serverUrl = serverUrl
    else if (saved.serverUrl) setupToSave.serverUrl = saved.serverUrl
    saveSetup(setupToSave)
    console.log('Saved. Run `highwayman setup` any time to change these.\n')
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
