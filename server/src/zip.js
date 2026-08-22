import { ZipArchive } from 'archiver'

// A ready-to-pipe zip stream of `dirPath` — never buffers the whole archive
// in memory. Used by the browser-download route: piped straight into the
// HTTP response.
export function createZipStream(dirPath) {
  const archive = new ZipArchive({ zlib: { level: 9 } })
  archive.directory(dirPath, false)
  archive.finalize()
  return archive
}
