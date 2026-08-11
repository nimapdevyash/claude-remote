import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ACCOUNT_PATH = path.join(__dirname, '..', 'data', 'account.json')

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return { salt, hash }
}

function matches(account, password) {
  if (!account) return false
  const { hash } = hashPassword(password, account.salt)
  const a = Buffer.from(hash, 'hex')
  const b = Buffer.from(account.hash, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function load() {
  try {
    return JSON.parse(fs.readFileSync(ACCOUNT_PATH, 'utf-8'))
  } catch {
    return null
  }
}

function save(acc) {
  fs.mkdirSync(path.dirname(ACCOUNT_PATH), { recursive: true })
  fs.writeFileSync(ACCOUNT_PATH, JSON.stringify(acc, null, 2))
}

let account = load()

// If ADMIN_USERNAME/ADMIN_PASSWORD are set in server/.env, they're the
// source of truth for the single account on every boot (not just the
// first one) — synced to match if needed, and kept in plaintext here
// only for the length of this process so the server can print "sign in
// with" on startup. The account file itself always stores a salted hash,
// never the password.
const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env
let envCredentials = null
if (ADMIN_USERNAME?.trim() && ADMIN_PASSWORD) {
  const username = ADMIN_USERNAME.trim()
  const upToDate = account?.username === username && matches(account, ADMIN_PASSWORD)
  if (!upToDate) {
    const { salt, hash } = hashPassword(ADMIN_PASSWORD)
    account = { username, salt, hash }
    save(account)
  }
  envCredentials = { username, password: ADMIN_PASSWORD }
}

export const accounts = {
  exists() {
    return Boolean(account)
  },
  username() {
    return account?.username ?? null
  },
  // Non-null only when the password is known in plaintext right now
  // (came from server/.env this boot) — never derived from the stored
  // hash, which is intentionally one-way.
  envCredentials() {
    return envCredentials
  },
  create(username, password) {
    const { salt, hash } = hashPassword(password)
    account = { username, salt, hash }
    save(account)
    if (envCredentials) envCredentials = null // .env no longer describes the live account
  },
  verify(username, password) {
    return account?.username === username && matches(account, password)
  },
}
