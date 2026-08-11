import path from 'path'

// Resolves a root-relative path and guarantees it stays inside `root`,
// throwing on any attempt to escape it (e.g. via `..`).
export function resolveSafe(root, relPath) {
  const cleaned = path.normalize(relPath || '').replace(/^([.][.][/\\])+/, '')
  const target = path.resolve(root, cleaned)
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep
  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new Error('Path escapes the runner root')
  }
  return target
}
