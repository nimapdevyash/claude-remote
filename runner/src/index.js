#!/usr/bin/env node
import { loadConfig, resetSetup } from './config.js'
import { ensureAuthToken } from './authClient.js'
import { ensureChatSession } from './chatSession.js'
import { startExecutor } from './executor.js'
import { startRepl } from './repl.js'
import { runAdminCommand } from './admin.js'
import { dim, bold, printHeader, printCommandHelp } from './renderer.js'

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
  printHeader('claude-remote')
  console.log("Run Claude Code from anywhere — reasoning happens on the server's")
  console.log('login; execution happens wherever this CLI is running.\n')

  console.log(bold('Commands'))
  printCommandHelp([
    {
      usage: 'claude-remote',
      description: 'Connect and open the interactive chat prompt.',
      example: 'claude-remote',
    },
    {
      usage: 'claude-remote setup',
      description: 'Re-run first-time setup (working folder, display name). The server URL is always asked fresh — see --server below.',
      example: 'claude-remote setup',
    },
    {
      usage: 'claude-remote admin list',
      description: 'List every account on the server. Admin accounts only.',
      example: 'claude-remote admin list',
    },
    {
      usage: 'claude-remote admin add <username> [--admin]',
      description: 'Create a new account, optionally as an admin. Admin accounts only.',
      example: 'claude-remote admin add rupali --admin',
    },
    {
      usage: 'claude-remote admin remove <username>',
      description: "Remove an account. Admin accounts only; you can't remove your own.",
      example: 'claude-remote admin remove rupali',
    },
  ])

  console.log(bold('Flags'))
  printCommandHelp([
    {
      usage: '--server <url>, -s <url>',
      description: "Skip the server URL prompt for this run. The URL is never saved — it's always asked fresh next time unless you pass this again.",
      example: 'claude-remote --server wss://abc123.ngrok-free.app/ws',
    },
    {
      usage: '--help, -h',
      description: 'Show this help.',
    },
  ])

  console.log(dim('Docs: https://nimapdevyash.github.io/claude-remote/'))
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
