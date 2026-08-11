import path from 'path'
import { config } from './config.js'

// Resolves a workspace-relative path and guarantees it stays inside
// config.workspaceRoot, throwing on any attempt to escape it (e.g. via `..`).
export function resolveWorkspacePath(relPath) {
  const cleaned = path.normalize(relPath || '').replace(/^([.][.][/\\])+/, '')
  const target = path.resolve(config.workspaceRoot, cleaned)
  const rootWithSep = config.workspaceRoot.endsWith(path.sep)
    ? config.workspaceRoot
    : config.workspaceRoot + path.sep
  if (target !== config.workspaceRoot && !target.startsWith(rootWithSep)) {
    throw new Error('Path escapes workspace root')
  }
  return target
}
