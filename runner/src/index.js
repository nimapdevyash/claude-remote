#!/usr/bin/env node
import { loadConfig, resetSetup } from './config.js'
import { ensureAuthToken } from './authClient.js'
import { ensureChatSession } from './chatSession.js'
import { startExecutor } from './executor.js'
import { startRepl } from './repl.js'

async function main() {
  if (process.argv[2] === 'setup') {
    resetSetup()
    console.log('Setup cleared — run `claude-remote-runner` again to reconfigure.')
    process.exit(0)
  }

  const config = await loadConfig()
  const token = await ensureAuthToken(config.httpBaseUrl)

  startExecutor({
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
    })
  } else {
    console.log(`claude-remote runner connected as "${config.name}" — root: ${config.root}`)
    console.log('Running in the background (no TTY). Ctrl+C to stop.')
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
