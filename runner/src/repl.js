import WebSocket from 'ws'
import { prompt } from './prompt.js'
import { createTurnPrinter, printBanner, printError, dim, PROMPT_SYMBOL } from './renderer.js'

async function authedFetch(httpBaseUrl, token, urlPath, options = {}) {
  return fetch(`${httpBaseUrl}${urlPath}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })
}

// The terminal-native counterpart to the web UI's chat feed: this opens a
// normal (non-runner-role) WebSocket subscription to one session and drives
// it from a `>` prompt, so sitting at this machine feels like running
// `claude` locally even though the reasoning happens on the server's login.
export async function startRepl({ serverUrl, httpBaseUrl, token, sessionId, name, root, overrideSource }) {
  let currentTurnId = null
  let printEvent = null
  let resolveTurn = null

  const ws = new WebSocket(`${serverUrl}?token=${encodeURIComponent(token)}`)

  await new Promise((resolve, reject) => {
    ws.once('open', resolve)
    ws.once('error', reject)
  })
  ws.send(JSON.stringify({ type: 'subscribe', sessionId }))

  ws.on('message', (raw) => {
    let msg
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }
    if (msg.sessionId !== sessionId) return

    if (msg.type === 'turn_started') {
      currentTurnId = msg.turnId
      printEvent = createTurnPrinter()
    } else if (msg.type === 'claude_event' && msg.turnId === currentTurnId) {
      printEvent?.(msg.event)
    } else if (msg.type === 'turn_finished' && msg.turnId === currentTurnId) {
      if (msg.status === 'failed' && msg.stderr) printError(msg.stderr)
      currentTurnId = null
      const resolve = resolveTurn
      resolveTurn = null
      resolve?.()
    }
  })

  ws.on('close', () => {
    printError('\nDisconnected from server.')
    process.exit(1)
  })

  printBanner({ name, root, sessionId, serverUrl, overrideSource })

  for (;;) {
    const line = await prompt(PROMPT_SYMBOL)
    const text = line.trim()
    if (!text) continue
    if (text === 'exit' || text === 'quit') break

    const res = await authedFetch(httpBaseUrl, token, `/api/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ prompt: text }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      printError(body.error || 'Failed to send message')
      continue
    }

    await new Promise((resolve) => {
      resolveTurn = resolve
    })
  }

  ws.close()
  console.log(dim('\nBye.'))
  process.exit(0)
}
