#!/usr/bin/env node
import { loadConfig, resetSetup } from './config.js'
import { ensureAuthToken } from './authClient.js'
import { ensureChatSession } from './chatSession.js'
import { startExecutor } from './executor.js'
import { startRepl } from './repl.js'
import { runAdminCommand } from './admin.js'
import { dim } from './renderer.js'

function parseArgs(argv) {
  let serverOverride = null
  let command = null
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--server' || arg === '-s') {
      serverOverride = argv[++i]
    } else if (arg.startsWith('--server=')) {
      serverOverride = arg.slice('--server='.length)
    } else if (arg === '--help' || arg === '-h') {
      command = 'help'
    } else if (!command && !arg.startsWith('-')) {
      command = arg
    } else {
      rest.push(arg)
    }
  }
  return { serverOverride, command, rest }
}

function printHelp() {
  console.log(`
claude-remote — run Claude Code from anywhere, executed on this machine

Usage:
  claude-remote                    Connect and open the chat prompt
  claude-remote setup               Re-run first-time setup (server, root, name)
  claude-remote --server <url>      Use this server URL for just this run
  claude-remote -s <url>            Shorthand for --server

  claude-remote admin list                    List accounts (admin only)
  claude-remote admin add <username> [--admin] Create an account (admin only)
  claude-remote admin remove <username>       Remove an account (admin only)

Examples:
  claude-remote --server wss://abc123.ngrok-free.app/ws
  claude-remote admin add rupali
`)
}

async function main() {
  const { serverOverride, command, rest } = parseArgs(process.argv.slice(2))

  if (command === 'help') {
    printHelp()
    process.exit(0)
  }

  if (command === 'setup') {
    resetSetup()
    console.log('Setup cleared — run `claude-remote` again to reconfigure.')
    process.exit(0)
  }

  if (command === 'admin') {
    const config = await loadConfig({ serverOverride, minimal: true })
    const token = await ensureAuthToken(config.httpBaseUrl)
    const [subcommand, ...subArgs] = rest
    await runAdminCommand(config.httpBaseUrl, token, subcommand, subArgs)
    return
  }

  const config = await loadConfig({ serverOverride })
  const token = await ensureAuthToken(config.httpBaseUrl)

  await startExecutor({
    serverUrl: config.serverUrl,
    token,
    runnerId: config.runnerId,
    name: config.name,
    root: config.root,
  })

  if (process.stdin.isTTY) {
    const sessionId = await ensureChatSession(config.httpBaseUrl, token, config.runnerId, config.name)
    await startRepl({
      serverUrl: config.serverUrl,
      httpBaseUrl: config.httpBaseUrl,
      token,
      sessionId,
      name: config.name,
      root: config.root,
      overrideSource: config.overrideSource,
    })
  } else {
    console.log(`claude-remote connected as "${config.name}" — root: ${config.root}`)
    console.log(dim('Running in the background (no TTY). Ctrl+C to stop.'))
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
