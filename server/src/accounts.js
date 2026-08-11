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

function bootstrapFromEnv() {
  const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env
  if (!ADMIN_USERNAME?.trim() || !ADMIN_PASSWORD) return null
  const { salt, hash } = hashPassword(ADMIN_PASSWORD)
  const created = { username: ADMIN_USERNAME.trim(), salt, hash }
  save(created)
  console.log(`  Created account "${created.username}" from ADMIN_USERNAME/ADMIN_PASSWORD in .env`)
  return created
}

let account = load() || bootstrapFromEnv()

export const accounts = {
  exists() {
    return Boolean(account)
  },
  username() {
    return account?.username ?? null
  },
  create(username, password) {
    const { salt, hash } = hashPassword(password)
    account = { username, salt, hash }
    save(account)
  },
  verify(username, password) {
    if (!account || account.username !== username) return false
    const { hash } = hashPassword(password, account.salt)
    const a = Buffer.from(hash, 'hex')
    const b = Buffer.from(account.hash, 'hex')
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  },
}
