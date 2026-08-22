import fs from 'fs'
import path from 'path'
import { Router } from 'express'
import { config } from '../config.js'
import { resolveWorkspacePath } from '../paths.js'
import { createZipStream } from '../zip.js'

export const fsRouter = Router()

// Lists subdirectories under WORKSPACE_ROOT/<path> so the UI can offer a
// folder picker when creating a new session, without ever escaping the root.
fsRouter.get('/browse', (req, res) => {
  const rel = req.query.path ? String(req.query.path) : ''
  let target
  try {
    target = resolveWorkspacePath(rel)
  } catch {
    return res.status(400).json({ error: 'Invalid path' })
  }

  let entries
  try {
    entries = fs.readdirSync(target, { withFileTypes: true })
  } catch {
    return res.status(404).json({ error: 'Directory not found' })
  }

  const dirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b))

  const relOut = path.relative(config.workspaceRoot, target)
  const normalizedRel = relOut === '.' || relOut === '' ? '' : relOut
  const parent =
    normalizedRel === ''
      ? null
      : path.dirname(normalizedRel) === '.'
        ? ''
        : path.dirname(normalizedRel)

  res.json({
    root: config.workspaceRoot,
    path: normalizedRel,
    parent,
    dirs,
  })
})

// Streams WORKSPACE_ROOT/<path> back to the browser — a single file as-is,
// a directory zipped on the fly and never buffered fully in memory. Same
// workspace-root sandboxing as /browse.
fsRouter.get('/download', (req, res) => {
  const rel = req.query.path ? String(req.query.path) : ''
  let target
  try {
    target = resolveWorkspacePath(rel)
  } catch {
    return res.status(400).json({ error: 'Invalid path' })
  }

  let stat
  try {
    stat = fs.statSync(target)
  } catch {
    return res.status(404).json({ error: 'Not found' })
  }

  const name = path.basename(target) || 'download'

  if (stat.isFile()) {
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`)
    return res.sendFile(target)
  }

  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="${name}.zip"`)
  const archive = createZipStream(target)
  archive.on('error', (err) => res.destroy(err))
  archive.pipe(res)
})
