import fs from 'fs'
import path from 'path'
import { resolveSafe } from './paths.js'

// Resolves a path the user typed at the `@fileupload` command against
// `root` — accepting either an absolute path already inside root, or one
// relative to it — and confirms it's an actual file, not a directory or a
// dangling path. No bytes move here: the runner's `root` is the same
// machine Claude will later Read from over the remote_* MCP tools, so
// "uploading" from the REPL is just validating + remembering the path.
export function resolveAttachment(root, input) {
  const raw = input.trim()
  if (!raw) throw new Error('no path given')

  let target
  if (path.isAbsolute(raw)) {
    const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep
    const normalized = path.normalize(raw)
    if (normalized !== root && !normalized.startsWith(rootWithSep)) {
      throw new Error(`is outside this runner's root (${root})`)
    }
    target = normalized
  } else {
    target = resolveSafe(root, raw)
  }

  let stat
  try {
    stat = fs.statSync(target)
  } catch {
    throw new Error('no such file')
  }
  if (!stat.isFile()) throw new Error('not a file')

  const relPath = path.relative(root, target)
  return { absPath: target, relPath, name: path.basename(target) }
}

export function formatAttachmentBlock(attachments) {
  if (attachments.length === 0) return ''
  const lines = attachments.map((a) => `- ${a.relPath}`)
  return `\n\nAttached file${attachments.length === 1 ? '' : 's'} (paths relative to this machine's root):\n${lines.join('\n')}`
}
