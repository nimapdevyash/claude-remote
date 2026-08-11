#!/usr/bin/env node
// Builds the client, starts the production server, and opens an ngrok
// tunnel to it — printing the public URL instead of localhost. Requires
// the `ngrok` CLI to already be installed and authenticated
// (`ngrok config add-authtoken <token>`, from your ngrok dashboard).
import { spawn } from 'child_process'
import fs from 'fs'
import readline from 'readline'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const PORT = process.env.PORT || '4317'

// Reads ADMIN_USERNAME/ADMIN_PASSWORD straight out of server/.env (if set)
// so they can be folded into the final banner below — the same values the
// server itself will sync the account to and print on its own startup.
function readEnvCredentials() {
  let text
  try {
    text = fs.readFileSync(path.join(ROOT, 'server', '.env'), 'utf-8')
  } catch {
    return null
  }
  const username = text.match(/^ADMIN_USERNAME=(.*)$/m)?.[1]?.trim()
  const password = text.match(/^ADMIN_PASSWORD=(.*)$/m)?.[1]
  return username && password ? { username, password } : null
}

function checkNgrokInstalled() {
  return new Promise((resolve) => {
    const probe = spawn('ngrok', ['version'])
    probe.on('error', () => resolve(false))
    probe.on('exit', (code) => resolve(code === 0))
  })
}

function runToCompletion(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts })
    child.on('error', reject)
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`))))
  })
}

// ngrok already detects and works around a local-API port conflict with
// another ngrok agent on this machine on its own (falls back off 4040) —
// so rather than trying to pin/guess that port, this reads the tunnel URL
// straight out of ngrok's own JSON-formatted log stream.
function startNgrokAndWaitForUrl(port, { onLine } = {}) {
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

async function main() {
  if (!(await checkNgrokInstalled())) {
    console.error('ngrok is not installed or not on PATH.')
    console.error('Install it from https://ngrok.com/download, run `ngrok config add-authtoken <token>`')
    console.error('(from your ngrok dashboard), then try again.')
    process.exit(1)
  }

  console.log('[serve-public] Building client...')
  await runToCompletion('npm', ['run', 'build', '-w', 'client'], { cwd: ROOT })

  console.log('[serve-public] Starting server...')
  // Spawned directly (not via `npm run`) so killing this child actually
  // kills the server process — npm wraps its script in a shell that
  // doesn't reliably forward signals to what it launches.
  const server = spawn('node', ['src/index.js'], {
    cwd: path.join(ROOT, 'server'),
    stdio: 'inherit',
    env: { ...process.env, PORT },
  })

  console.log('[serve-public] Starting ngrok tunnel...')
  const { ngrok, urlPromise } = startNgrokAndWaitForUrl(PORT)

  let shuttingDown = false
  function shutdown(code = 0) {
    if (shuttingDown) return
    shuttingDown = true
    server.kill()
    ngrok.kill()
    process.exit(code)
  }
  process.on('SIGINT', () => shutdown(0))
  process.on('SIGTERM', () => shutdown(0))
  server.on('exit', (code) => shutdown(code ?? 1))
  ngrok.on('exit', (code) => {
    if (code !== 0 && code !== null) shutdown(code)
  })

  let publicUrl
  try {
    publicUrl = await Promise.race([
      urlPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for the ngrok tunnel to come up.')), 20000)),
    ])
  } catch (err) {
    console.error(`[serve-public] ${err.message}`)
    shutdown(1)
    return
  }

  const wsUrl = publicUrl.replace(/^https/, 'wss').replace(/^http/, 'ws')
  const creds = readEnvCredentials()
  const lines = [
    '',
    '='.repeat(64),
    `  claude-remote is live at: ${publicUrl}`,
    `  (local: http://localhost:${PORT})`,
    '',
  ]
  if (creds) {
    lines.push(`  Sign in with:  ${creds.username} / ${creds.password}`, '')
  }
  lines.push(
    '  CLI setup (macOS/Linux) — Windows PowerShell version in the README:',
    '    curl -fsSL https://raw.githubusercontent.com/nimapdevyash/claude-remote/main/install.sh | bash',
    '',
    '  Then connect it to this tunnel for just this run:',
    `    claude-remote --server ${wsUrl}/ws`,
    '='.repeat(64),
    '',
  )
  console.log(lines.join('\n'))
}

main()
