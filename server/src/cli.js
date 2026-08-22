#!/usr/bin/env node
// `highwayman-server` — runs the API/WebSocket server as a background
// daemon so it doesn't need a dedicated foreground terminal (`npm run dev`)
// to stay up. Resolves its own real location via import.meta.url, so it
// works the same whether invoked from a global `npm link` bin or straight
// out of the repo, regardless of the caller's cwd.
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { config } from './config.js'
import { accounts } from './accounts.js'
import { sendMail, isTransportConfigured } from './mailer.js'
import { buildConnectionInfoEmail } from './emailTemplate.js'
import { checkNgrokInstalled } from '../../scripts/ngrok-util.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SERVER_ROOT = path.resolve(__dirname, '..')
const INDEX = path.join(SERVER_ROOT, 'src', 'index.js')

const RUN_DIR = path.join(os.homedir(), '.highwayman')
const PID_FILE = path.join(RUN_DIR, 'server.pid')
const LOG_FILE = path.join(RUN_DIR, 'server.log')
const NGROK_PID_FILE = path.join(RUN_DIR, 'ngrok.pid')
const NGROK_LOG_FILE = path.join(RUN_DIR, 'ngrok.log')

function isRunning(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function readPidFile(file) {
  try {
    const pid = Number(fs.readFileSync(file, 'utf-8').trim())
    return Number.isInteger(pid) && pid > 0 ? pid : null
  } catch {
    return null
  }
}

function clearFile(file) {
  try {
    fs.rmSync(file)
  } catch {
    // already gone
  }
}

// --- ngrok tunnel, managed the same detached-process-plus-PID-file way as
// the server itself, so `highwayman-server start`/`stop` own its lifecycle
// too instead of leaving an orphaned tunnel behind. ------------------------

function startNgrokTunnel(port) {
  fs.mkdirSync(RUN_DIR, { recursive: true })
  fs.writeFileSync(NGROK_LOG_FILE, '') // fresh log each run, so URL-parsing below never sees a stale tunnel's line
  const out = fs.openSync(NGROK_LOG_FILE, 'a')
  const err = fs.openSync(NGROK_LOG_FILE, 'a')
  const child = spawn('ngrok', ['http', String(port), '--log=stdout', '--log-format=json'], {
    detached: true,
    stdio: ['ignore', out, err],
  })
  fs.writeFileSync(NGROK_PID_FILE, String(child.pid))
  child.unref()
}

// ngrok's log is JSON-lines; reading it back off disk (rather than piping
// its stdout live) is what lets the tunnel process stay fully detached —
// a pipe would need this CLI to stay alive draining it.
function readNgrokUrlFromLog() {
  let content
  try {
    content = fs.readFileSync(NGROK_LOG_FILE, 'utf-8')
  } catch {
    return null
  }
  for (const line of content.split('\n').reverse()) {
    try {
      const parsed = JSON.parse(line)
      if (parsed.msg === 'started tunnel' && parsed.url) return parsed.url
    } catch {
      // non-JSON or unrelated log line
    }
  }
  return null
}

async function waitForNgrokUrl(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const url = readNgrokUrlFromLog()
    if (url) return url
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return null
}

function stopNgrokTunnel() {
  const pid = readPidFile(NGROK_PID_FILE)
  if (pid && isRunning(pid)) {
    process.kill(pid, 'SIGTERM')
    clearFile(NGROK_PID_FILE)
    return true
  }
  clearFile(NGROK_PID_FILE)
  return false
}

function ngrokStatus() {
  const pid = readPidFile(NGROK_PID_FILE)
  const running = Boolean(pid && isRunning(pid))
  return { running, pid: running ? pid : null, url: running ? readNgrokUrlFromLog() : null }
}

// --- Connection info: the same "here's how to reach it" summary
// `npm run dev`/`npm run serve:public` print to the console, gathered here
// so both `connection-info` and the startup email can share it. -----------

function gatherConnectionInfo() {
  const serverPid = readPidFile(PID_FILE)
  const serverRunning = Boolean(serverPid && isRunning(serverPid))
  const ngrok = ngrokStatus()
  const creds = accounts.envCredentials()
  const roles = accounts.listWithRoles()
  return {
    serverRunning,
    serverPid: serverRunning ? serverPid : null,
    localUrl: `http://localhost:${config.port}`,
    publicUrl: ngrok.url,
    ngrokRunning: ngrok.running,
    creds,
    roles,
  }
}

// `includePassword` is only ever true for console output (`connection-info`,
// `status`) — never for email, since email isn't a secure channel and a
// plaintext password sitting in an inbox indefinitely is a real liability.
function formatConnectionInfo(info, { includePassword = true } = {}) {
  const lines = []
  lines.push(`Highwayman server: ${info.serverRunning ? `running (pid ${info.serverPid})` : 'not running'}`)
  lines.push(`Local URL:  ${info.localUrl}`)
  if (info.publicUrl) {
    lines.push(`Public URL: ${info.publicUrl}`)
  } else if (info.ngrokRunning) {
    lines.push('Public URL: (ngrok tunnel is up, but no URL yet — try again in a moment)')
  } else {
    lines.push('Public URL: none (no ngrok tunnel running — start with --public to open one)')
  }
  const connectUrl = info.publicUrl || info.localUrl
  const wsUrl = connectUrl.replace(/^https/, 'wss').replace(/^http/, 'ws')
  lines.push('')
  lines.push('Runner CLI setup on another machine:')
  lines.push('  1. Install (macOS/Linux):')
  lines.push('     curl -fsSL https://raw.githubusercontent.com/nimapdevyash/claude-remote/main/install.sh | bash')
  lines.push('     (Windows PowerShell: iwr https://raw.githubusercontent.com/nimapdevyash/claude-remote/main/install.ps1 -useb | iex)')
  lines.push('  2. Connect:')
  lines.push(`     highwayman --server ${wsUrl}/ws`)
  if (!info.publicUrl) {
    lines.push('     (no public URL — "localhost" above only works from this same machine;')
    lines.push('      swap in this machine\'s LAN IP, or restart with --public for a real tunnel URL)')
  }
  lines.push('')
  if (includePassword && info.creds) {
    lines.push('Sign in with:')
    lines.push(`  username: ${info.creds.username}`)
    lines.push(`  password: ${info.creds.password}`)
    const others = info.roles.filter((a) => a.username !== info.creds.username)
    if (others.length > 0) {
      lines.push(`Other accounts (password not shown): ${others.map((a) => (a.isAdmin ? `${a.username} (admin)` : a.username)).join(', ')}`)
    }
  } else if (info.roles.length > 0) {
    lines.push(`Accounts (password not shown): ${info.roles.map((a) => (a.isAdmin ? `${a.username} (admin)` : a.username)).join(', ')}`)
    if (!includePassword) lines.push('Passwords are never emailed — sign in with the one you already have.')
    else lines.push('(set ADMIN_USERNAME/ADMIN_PASSWORD in server/.env to have one printed here)')
  } else {
    lines.push('No accounts configured yet — run `npm run create-account -w server`.')
  }
  return lines
}

async function notifyByEmail(info, explicitTo) {
  if (!isTransportConfigured()) {
    console.log('Warning: SMTP not configured (SMTP_USER/SMTP_PASS) — skipping the setup email.')
    console.log('Set them in server/.env or your own shell environment, and MAIL_TO for a default recipient list.')
    return
  }
  const title = 'Highwayman server is up'
  const lines = [`Highwayman server started at ${new Date().toISOString()}`, '', ...formatConnectionInfo(info, { includePassword: false })]
  const result = await sendMail({
    subject: `${title}${info.publicUrl ? ` — ${info.publicUrl}` : ''}`,
    text: lines.join('\n'),
    html: buildConnectionInfoEmail(info, { title }),
    to: explicitTo,
  })
  if (result.sent) {
    console.log(`Setup email sent to ${result.to.join(', ')}.`)
  } else {
    console.log(`Skipped email notification: ${result.reason}`)
  }
}

// --- Server process itself ------------------------------------------------

async function start({ public: openTunnel = false, to = null } = {}) {
  const existing = readPidFile(PID_FILE)
  if (existing && isRunning(existing)) {
    console.log(`Highwayman server is already running (pid ${existing}).`)
    return
  }
  clearFile(PID_FILE)

  fs.mkdirSync(RUN_DIR, { recursive: true })
  const out = fs.openSync(LOG_FILE, 'a')
  const err = fs.openSync(LOG_FILE, 'a')
  const child = spawn(process.execPath, [INDEX], {
    cwd: SERVER_ROOT,
    detached: true,
    stdio: ['ignore', out, err],
  })
  fs.writeFileSync(PID_FILE, String(child.pid))
  child.unref()
  console.log(`Highwayman server started (pid ${child.pid}).`)
  console.log(`Logs: ${LOG_FILE}`)

  if (openTunnel) {
    if (await checkNgrokInstalled()) {
      console.log('Starting ngrok tunnel...')
      startNgrokTunnel(config.port)
      const url = await waitForNgrokUrl()
      if (url) console.log(`Public URL: ${url}`)
      else console.log('Timed out waiting for the ngrok tunnel to come up — continuing without a public URL.')
    } else {
      console.log('ngrok not found on PATH — skipping the public tunnel (install it from https://ngrok.com/download to enable one).')
    }
  }

  await notifyByEmail(gatherConnectionInfo(), to)
}

function stop() {
  const pid = readPidFile(PID_FILE)
  if (pid && isRunning(pid)) {
    process.kill(pid, 'SIGTERM')
    console.log(`Highwayman server stopped (pid ${pid}).`)
  } else {
    console.log('Highwayman server is not running.')
  }
  clearFile(PID_FILE)

  if (stopNgrokTunnel()) console.log('ngrok tunnel stopped.')
}

function status() {
  const info = gatherConnectionInfo()
  if (info.serverRunning) console.log(`Highwayman server is running (pid ${info.serverPid}).`)
  else console.log('Highwayman server is not running.')
  if (info.ngrokRunning) console.log(`ngrok tunnel: running${info.publicUrl ? ` — ${info.publicUrl}` : ''}`)
  if (!isTransportConfigured()) console.log('Note: SMTP not configured (SMTP_USER/SMTP_PASS) — email notifications are off.')
}

async function restart(opts) {
  stop()
  await start(opts)
}

function logs() {
  if (!fs.existsSync(LOG_FILE)) {
    console.log(`No log file yet at ${LOG_FILE} — start the server first.`)
    return
  }
  spawn('tail', ['-f', LOG_FILE], { stdio: 'inherit' })
}

function connectionInfo() {
  formatConnectionInfo(gatherConnectionInfo()).forEach((line) => console.log(line))
}

async function mailCommand(recipients) {
  if (recipients.length === 0) {
    console.log('Usage: highwayman-server mail <email> [email...]')
    process.exit(1)
  }
  if (!isTransportConfigured()) {
    console.log('Warning: SMTP not configured (SMTP_USER/SMTP_PASS) — set them in server/.env or your own shell environment.')
    process.exit(1)
  }
  const info = gatherConnectionInfo()
  const title = 'Highwayman connection info'
  const lines = [`${title} — ${new Date().toISOString()}`, '', ...formatConnectionInfo(info, { includePassword: false })]
  const result = await sendMail({ subject: title, text: lines.join('\n'), html: buildConnectionInfoEmail(info, { title }), to: recipients })
  if (result.sent) console.log(`Sent to ${result.to.join(', ')}.`)
  else console.log(`Could not send: ${result.reason}`)
}

function printHelp() {
  console.log(`Usage: highwayman-server <command> [options]

Commands:
  start             Start the server in the background and email the
                     connection info (skipped with a warning if SMTP isn't configured)
  stop              Stop the background server (and its ngrok tunnel, if any)
  restart           Stop, then start again
  status            Show whether it's running
  logs              Follow the server's log file
  connection-info   Print local/public URLs, connect command, and sign-in info
  mail <email...>   Email the current connection info to any address(es) you list,
                     regardless of MAIL_TO

Options (start/restart):
  --public, -p      Also open an ngrok tunnel and include its URL
  --to <emails>      Comma-separated recipients for this run's email, instead of MAIL_TO

SMTP (SMTP_USER, SMTP_PASS, and optionally SMTP_HOST/PORT/SECURE, MAIL_FROM,
MAIL_TO) must be set in server/.env or your own shell environment — never
commit real values.`)
}

function parseFlags(argv) {
  const flags = { public: false, to: null, positional: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--public' || arg === '-p') flags.public = true
    else if (arg === '--to' || arg === '-t') flags.to = argv[++i] || null
    else if (arg.startsWith('--to=')) flags.to = arg.slice('--to='.length)
    else flags.positional.push(arg)
  }
  return flags
}

const [command, ...rest] = process.argv.slice(2)
const flags = parseFlags(rest)
const toList = flags.to ? flags.to.split(',').map((s) => s.trim()).filter(Boolean) : null

switch (command) {
  case 'start':
    await start({ public: flags.public, to: toList })
    break
  case 'stop':
    stop()
    break
  case 'restart':
    await restart({ public: flags.public, to: toList })
    break
  case 'status':
    status()
    break
  case 'logs':
    logs()
    break
  case 'connection-info':
    connectionInfo()
    break
  case 'mail':
    await mailCommand(flags.positional.flatMap((a) => a.split(',')).map((s) => s.trim()).filter(Boolean))
    break
  default:
    printHelp()
    process.exit(command ? 1 : 0)
}
