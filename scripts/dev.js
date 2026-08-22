#!/usr/bin/env node
// One command for a full dev setup: runs the server (hot-reloading) and
// client (Vite) side by side, opens an ngrok tunnel to the server, and
// prints everything needed to connect a CLI to it from anywhere. Leave
// this running — it keeps the server, client, and tunnel up until you
// stop it.
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { checkNgrokInstalled, startNgrokAndWaitForUrl } from './ngrok-util.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const PORT = process.env.PORT || '4317'

async function main() {
  const hasNgrok = await checkNgrokInstalled()
  if (!hasNgrok) {
    console.error('[dev] ngrok is not installed or not on PATH — skipping the tunnel, this will only be reachable locally.')
    console.error('[dev] Install it from https://ngrok.com/download, run `ngrok config add-authtoken <token>`, then restart.')
  }

  const app = spawn(
    'concurrently',
    ['-n', 'server,client', '-c', 'blue,magenta', 'npm run dev -w server', 'npm run dev -w client'],
    {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, HIGHWAYMAN_SUPPRESS_CREDENTIALS: hasNgrok ? '1' : '' },
    },
  )

  let ngrok = null
  let shuttingDown = false
  function shutdown(code = 0) {
    if (shuttingDown) return
    shuttingDown = true
    app.kill()
    ngrok?.kill()
    process.exit(code)
  }
  process.on('SIGINT', () => shutdown(0))
  process.on('SIGTERM', () => shutdown(0))
  app.on('exit', (code) => shutdown(code ?? 1))

  if (!hasNgrok) return

  const started = startNgrokAndWaitForUrl(PORT)
  ngrok = started.ngrok
  ngrok.on('exit', (code) => {
    if (code !== 0 && code !== null) console.error(`[dev] ngrok exited with code ${code} — tunnel is down, dev server is still up locally.`)
  })

  let publicUrl
  try {
    publicUrl = await Promise.race([
      started.urlPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for the ngrok tunnel to come up.')), 20000)),
    ])
  } catch (err) {
    console.error(`[dev] ${err.message}`)
    return
  }

  const wsUrl = publicUrl.replace(/^https/, 'wss').replace(/^http/, 'ws')
  console.log(
    [
      '',
      '='.repeat(64),
      `  Tunnel is live at: ${publicUrl}`,
      `  (local server: http://localhost:${PORT})`,
      '',
      '  CLI setup (macOS/Linux) — Windows PowerShell version in the README:',
      '    curl -fsSL https://raw.githubusercontent.com/nimapdevyash/claude-remote/main/install.sh | bash',
      '',
      '  Then connect it to this tunnel for just this run:',
      `    highwayman --server ${wsUrl}/ws`,
      '='.repeat(64),
      '',
    ].join('\n'),
  )
}

main()
