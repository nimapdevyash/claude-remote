// Shared ngrok helpers used by both scripts/dev.js and scripts/serve-public.js.
import { spawn } from 'child_process'
import readline from 'readline'

export function checkNgrokInstalled() {
  return new Promise((resolve) => {
    const probe = spawn('ngrok', ['version'])
    probe.on('error', () => resolve(false))
    probe.on('exit', (code) => resolve(code === 0))
  })
}

// ngrok already detects and works around a local-API port conflict with
// another ngrok agent on this machine on its own (falls back off 4040) —
// so rather than trying to pin/guess that port, this reads the tunnel URL
// straight out of ngrok's own JSON-formatted log stream.
export function startNgrokAndWaitForUrl(port, { onLine } = {}) {
  const ngrok = spawn('ngrok', ['http', String(port), '--log=stdout', '--log-format=json'], {
    stdio: ['ignore', 'pipe', 'inherit'],
  })

  const urlPromise = new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: ngrok.stdout })
    rl.on('line', (line) => {
      onLine?.(line)
      try {
        const parsed = JSON.parse(line)
        if (parsed.msg === 'started tunnel' && parsed.url) {
          resolve(parsed.url)
        }
      } catch {
        // non-JSON or unrelated log line
      }
    })
    ngrok.on('exit', (code) => {
      if (code !== 0) reject(new Error(`ngrok exited with code ${code} before a tunnel came up`))
    })
  })

  return { ngrok, urlPromise }
}
