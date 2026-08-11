import path from 'path'
import crypto from 'crypto'
import dotenv from 'dotenv'

dotenv.config()

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
