import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { resolveSafe } from './paths.js'

function run(command, cwd) {
  return new Promise((resolve) => {
    exec(command, { cwd, maxBuffer: 10 * 1024 * 1024, timeout: 5 * 60 * 1000 }, (err, stdout, stderr) => {
      resolve({ stdout, stderr, exitCode: err ? err.code ?? 1 : 0 })
    })
  })
}

export function createActions(root) {
  return {
    async exec({ command, cwd }) {
      if (!command) throw new Error('command is required')
      return run(command, resolveSafe(root, cwd || ''))
    },

    async read_file({ path: relPath }) {
      if (!relPath) throw new Error('path is required')
      const content = fs.readFileSync(resolveSafe(root, relPath), 'utf-8')
      return { content }
    },

    async write_file({ path: relPath, content, encoding }) {
      if (!relPath) throw new Error('path is required')
      const target = resolveSafe(root, relPath)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      const buf = encoding === 'base64' ? Buffer.from(content ?? '', 'base64') : Buffer.from(content ?? '', 'utf-8')
      fs.writeFileSync(target, buf)
      return { bytes: buf.length }
    },

    async edit_file({ path: relPath, old_string, new_string, replace_all }) {
      if (!relPath) throw new Error('path is required')
      if (typeof old_string !== 'string' || typeof new_string !== 'string') {
        throw new Error('old_string and new_string are required')
      }
      const target = resolveSafe(root, relPath)
      const original = fs.readFileSync(target, 'utf-8')
      const occurrences = original.split(old_string).length - 1
      if (occurrences === 0) throw new Error('old_string was not found in the file')
      if (!replace_all && occurrences > 1) {
        throw new Error(`old_string is not unique (${occurrences} matches) — pass replace_all or a more specific string`)
      }
      const updated = replace_all ? original.split(old_string).join(new_string) : original.replace(old_string, new_string)
      fs.writeFileSync(target, updated)
      return { replaced: replace_all ? occurrences : 1 }
    },

    async list_dir({ path: relPath }) {
      const target = resolveSafe(root, relPath || '')
      const entries = fs.readdirSync(target, { withFileTypes: true })
      const dirs = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b))
      const relOut = path.relative(root, target)
      const normalized = relOut === '.' || relOut === '' ? '' : relOut
      const parent = normalized === '' ? null : path.dirname(normalized) === '.' ? '' : path.dirname(normalized)
      return { root, path: normalized, parent, dirs }
    },
  }
}
