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

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SERVER_ROOT = path.resolve(__dirname, '..')
const INDEX = path.join(SERVER_ROOT, 'src', 'index.js')

const RUN_DIR = path.join(os.homedir(), '.highwayman')
const PID_FILE = path.join(RUN_DIR, 'server.pid')
const LOG_FILE = path.join(RUN_DIR, 'server.log')

function isRunning(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function readPid() {
  try {
    const pid = Number(fs.readFileSync(PID_FILE, 'utf-8').trim())
    return Number.isInteger(pid) && pid > 0 ? pid : null
  } catch {
    return null
  }
}

function clearPidFile() {
  try {
    fs.rmSync(PID_FILE)
  } catch {
    // already gone
  }
}

function start() {
  const existing = readPid()
  if (existing && isRunning(existing)) {
    console.log(`Highwayman server is already running (pid ${existing}).`)
    return
  }
  clearPidFile()

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
}

function stop() {
  const pid = readPid()
  if (!pid || !isRunning(pid)) {
    console.log('Highwayman server is not running.')
    clearPidFile()
    return
  }
  process.kill(pid, 'SIGTERM')
  clearPidFile()
  console.log(`Highwayman server stopped (pid ${pid}).`)
}

function status() {
  const pid = readPid()
  if (pid && isRunning(pid)) {
    console.log(`Highwayman server is running (pid ${pid}).`)
  } else {
    console.log('Highwayman server is not running.')
  }
}

function restart() {
  stop()
  start()
}

function logs() {
  if (!fs.existsSync(LOG_FILE)) {
    console.log(`No log file yet at ${LOG_FILE} — start the server first.`)
    return
  }
  spawn('tail', ['-f', LOG_FILE], { stdio: 'inherit' })
}

function printHelp() {
  console.log(`Usage: highwayman-server <start|stop|restart|status|logs>

  start    Start the server in the background
  stop     Stop the background server
  restart  Stop, then start again
  status   Show whether it's running
  logs     Follow the server's log file`)
}

const command = process.argv[2]
switch (command) {
  case 'start':
    start()
    break
  case 'stop':
    stop()
    break
  case 'restart':
    restart()
    break
  case 'status':
    status()
    break
  case 'logs':
    logs()
    break
  default:
    printHelp()
    process.exit(command ? 1 : 0)
}
