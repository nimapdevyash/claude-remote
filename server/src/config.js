import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// Resolved relative to this file, not the caller's cwd — bare
// `dotenv.config()` only finds server/.env when invoked with server/ as
// the working directory (true for `npm start`/`npm run dev`, false for
// the globally-linked `highwayman-server` run from anywhere else).
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const workspaceRoot = path.resolve(
  process.env.WORKSPACE_ROOT?.trim() || process.env.HOME || process.cwd(),
)

export const config = {
  port: Number(process.env.PORT) || 4317,
  // Only used between this process and MCP bridge subprocesses it spawns
  // locally for runner-targeted sessions; never sent to the browser.
  internalToken: crypto.randomBytes(24).toString('hex'),
  workspaceRoot,
  defaultPermissionMode: process.env.DEFAULT_PERMISSION_MODE?.trim() || 'acceptEdits',
  defaultModel: process.env.DEFAULT_MODEL?.trim() || null,
}
