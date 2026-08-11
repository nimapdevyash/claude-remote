import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'data')
const ACCOUNTS_PATH = path.join(DATA_DIR, 'accounts.json')
const LEGACY_ACCOUNT_PATH = path.join(DATA_DIR, 'account.json') // pre-multi-account, single {username,salt,hash}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return { salt, hash }
}

function matches(entry, password) {
  if (!entry) return false
  const { hash } = hashPassword(password, entry.salt)
  const a = Buffer.from(hash, 'hex')
  const b = Buffer.from(entry.hash, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function save(map) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(ACCOUNTS_PATH, JSON.stringify(map, null, 2))
}

function load() {
  try {
    return JSON.parse(fs.readFileSync(ACCOUNTS_PATH, 'utf-8'))
  } catch {
    // Fall back to migrating the old single-account file, if present.
  }
  try {
    const legacy = JSON.parse(fs.readFileSync(LEGACY_ACCOUNT_PATH, 'utf-8'))
    if (legacy?.username) {
      const migrated = { [legacy.username]: { salt: legacy.salt, hash: legacy.hash, isAdmin: false } }
      save(migrated)
      return migrated
    }
  } catch {
    // no legacy file either — genuinely no accounts yet
  }
  return {}
}

let accountsMap = load()

// If ADMIN_USERNAME/ADMIN_PASSWORD are set in server/.env, that ONE
// account is synced to match on every boot (not just the first), printed
// on startup, and always treated as an admin — the env var's name is the
// point. Other accounts default to non-admin unless explicitly promoted
// via accounts.create(username, password, { isAdmin: true }).
const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env
let envCredentials = null
if (ADMIN_USERNAME?.trim() && ADMIN_PASSWORD) {
  const username = ADMIN_USERNAME.trim()
  const current = accountsMap[username]
  if (!matches(current, ADMIN_PASSWORD) || !current?.isAdmin) {
    accountsMap = { ...accountsMap, [username]: { ...hashPassword(ADMIN_PASSWORD), isAdmin: true } }
    save(accountsMap)
  }
  envCredentials = { username, password: ADMIN_PASSWORD }
}

export const accounts = {
  hasAny() {
    return Object.keys(accountsMap).length > 0
  },
  list() {
    return Object.keys(accountsMap)
  },
  listWithRoles() {
    return Object.entries(accountsMap).map(([username, entry]) => ({
      username,
      isAdmin: Boolean(entry.isAdmin),
    }))
  },
  has(username) {
    return Boolean(accountsMap[username])
  },
  isAdmin(username) {
    return Boolean(accountsMap[username]?.isAdmin)
  },
  // Non-null only when that account's password is known in plaintext
  // right now (it came from server/.env this boot) — never derived from
  // the stored hash, which is intentionally one-way.
  envCredentials() {
    return envCredentials
  },
  create(username, password, { isAdmin } = {}) {
    const existing = accountsMap[username]
    accountsMap = {
      ...accountsMap,
      [username]: { ...hashPassword(password), isAdmin: isAdmin ?? existing?.isAdmin ?? false },
    }
    save(accountsMap)
    if (envCredentials?.username === username) envCredentials = null // .env no longer describes it accurately
  },
  remove(username) {
    if (!(username in accountsMap)) return false
    const { [username]: _removed, ...rest } = accountsMap
    accountsMap = rest
    save(accountsMap)
    if (envCredentials?.username === username) envCredentials = null
    return true
  },
  verify(username, password) {
    return matches(accountsMap[username], password)
  },
}
