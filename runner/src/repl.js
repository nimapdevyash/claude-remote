import WebSocket from 'ws'
import { prompt } from './prompt.js'
import { createTurnPrinter, createSpinner, printBanner, printError, printSuccess, dim, PROMPT_SYMBOL } from './renderer.js'
import { resolveAttachment, formatAttachmentBlock } from './attachments.js'

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
  let intentionalClose = false
  let everConnected = false
  let retryDelay = 1000
  const spinner = createSpinner()
  const pendingAttachments = []

  // '@fileupload' with paths inline attaches each right away; bare
  // '@fileupload' drops into a one-path-per-line loop so attaching many
  // files doesn't mean one very long command line. Nothing is sent to the
  // server here — attachments just ride along on the next real message.
  async function handleFileUpload(commandLine) {
    const args = commandLine.split(/\s+/).slice(1)

    function attach(raw) {
      try {
        const att = resolveAttachment(root, raw)
        pendingAttachments.push(att)
        printSuccess(`  attached ${att.relPath}`)
      } catch (err) {
        printError(`  ${raw}: ${err.message}`)
      }
    }

    if (args.length > 0) {
      args.forEach(attach)
      return
    }

    console.log(dim('  Enter a file path, one per line. Blank line to finish.'))
    for (;;) {
      const line = await prompt('  path> ')
      const raw = line.trim()
      if (!raw) break
      attach(raw)
    }
  }

  function handleMessage(raw) {
    let msg
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }
    if (msg.sessionId !== sessionId) return

    if (msg.type === 'turn_started') {
      currentTurnId = msg.turnId
      printEvent = createTurnPrinter(spinner)
      spinner.start()
    } else if (msg.type === 'claude_event' && msg.turnId === currentTurnId) {
      printEvent?.(msg.event)
    } else if (msg.type === 'turn_finished' && msg.turnId === currentTurnId) {
      spinner.stop()
      if (msg.status === 'failed' && msg.stderr) printError(msg.stderr)
      currentTurnId = null
      const resolve = resolveTurn
      resolveTurn = null
      resolve?.()
    }
  }

  // Reconnecting after a drop can't replay what was missed (the server
  // doesn't buffer events for offline subscribers), so if a turn was still
  // "running" when we lost the connection, the only way to unblock the
  // prompt again is to ask whether it's actually done now.
  async function reconcileAfterReconnect() {
    if (!resolveTurn) return
    try {
      const res = await authedFetch(httpBaseUrl, token, `/api/sessions/${sessionId}`)
      if (!res.ok) return
      const session = await res.json()
      if (session.status !== 'running') {
        printError('(missed some output while disconnected — that task has since finished; check the web UI for the full transcript)')
        currentTurnId = null
        const resolve = resolveTurn
        resolveTurn = null
        resolve?.()
      }
    } catch {
      // Server still unreachable — next reconnect attempt will retry this too.
    }
  }

  function connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${serverUrl}?token=${encodeURIComponent(token)}`)

      ws.once('open', () => {
        retryDelay = 1000
        ws.send(JSON.stringify({ type: 'subscribe', sessionId }))
        if (everConnected) {
          printSuccess('Reconnected.')
          reconcileAfterReconnect()
        }
        everConnected = true
        resolve(ws)
      })
      ws.once('error', reject)
      ws.on('message', handleMessage)

      ws.on('close', () => {
        if (intentionalClose) return
        spinner.stop()
        printError('\nConnection lost — reconnecting…')
        setTimeout(() => {
          connect().catch(() => {})
        }, retryDelay)
        retryDelay = Math.min(retryDelay * 1.6, 15000)
      })
    })
  }

  await connect()

  printBanner({ name, root, sessionId, serverUrl, overrideSource })
  console.log(dim('Type "@fileupload <path> [path...]" (or bare, for a multi-file prompt) to attach files from this machine.\n'))

  for (;;) {
    const line = await prompt(PROMPT_SYMBOL)
    const text = line.trim()
    if (!text) continue
    if (text === 'exit' || text === 'quit') break
    if (text === '@fileupload' || text.startsWith('@fileupload ')) {
      await handleFileUpload(text)
      continue
    }

    const outgoingPrompt = text + formatAttachmentBlock(pendingAttachments)

    let res
    try {
      res = await authedFetch(httpBaseUrl, token, `/api/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ prompt: outgoingPrompt }),
      })
    } catch {
      printError('Could not reach the server — check your connection and try again.')
      continue
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      printError(body.error || 'Failed to send message')
      continue
    }
    pendingAttachments.length = 0

    await new Promise((resolve) => {
      resolveTurn = resolve
    })
  }

  intentionalClose = true
  console.log(dim('\nBye.'))
  process.exit(0)
}
