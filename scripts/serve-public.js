#!/usr/bin/env node
// Builds the client, starts the production server, and opens an ngrok
// tunnel to it — printing the public URL instead of localhost. Requires
// the `ngrok` CLI to already be installed and authenticated
// (`ngrok config add-authtoken <token>`, from your ngrok dashboard).
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { checkNgrokInstalled, startNgrokAndWaitForUrl } from './ngrok-util.js'

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

// Usernames only, never passwords — those aren't recoverable from the
// stored hash, and this file only reads the same accounts.json the
// server itself manages.
function readOtherUsernames(excludeUsername) {
  try {
    const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'server', 'data', 'accounts.json'), 'utf-8'))
    return Object.keys(map).filter((u) => u !== excludeUsername)
  } catch {
    return []
  }
}

function runToCompletion(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts })
    child.on('error', reject)
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`))))
  })
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
    `  Highwayman is live at: ${publicUrl}`,
    `  (local: http://localhost:${PORT})`,
    '',
  ]
  if (creds) {
    lines.push(`  Sign in with:  ${creds.username} / ${creds.password}`)
    const others = readOtherUsernames(creds.username)
    if (others.length > 0) {
      lines.push(`  Other accounts (password not shown): ${others.join(', ')}`)
    }
    lines.push('')
  }
  lines.push(
    '  CLI setup (macOS/Linux) — Windows PowerShell version in the README:',
    '    curl -fsSL https://raw.githubusercontent.com/nimapdevyash/claude-remote/main/install.sh | bash',
    '',
    '  Then connect it to this tunnel for just this run:',
    `    highwayman --server ${wsUrl}/ws`,
    '='.repeat(64),
    '',
  )
  console.log(lines.join('\n'))
}

main()
