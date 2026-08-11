import WebSocket from 'ws'
import { createActions } from './actions.js'

// Connects as an authenticated runner and executes the exec/read_file/
// write_file/edit_file/list_dir requests the server relays from Claude
// Code's MCP tool calls, confined to `root`. Reconnects automatically.
// Returns a promise that resolves once the first connection is actually
// registered — callers that immediately create a session targeting this
// runner (e.g. the chat REPL) need to wait for that, not just for connect()
// to have been called, since over a real network (a tunnel, not
// localhost) the WS handshake can easily still be in flight.
export function startExecutor({ serverUrl, token, runnerId, name, root }) {
  const actions = createActions(root)
  let firstConnect = true
  let resolveReady
  const ready = new Promise((resolve) => {
    resolveReady = resolve
  })

  function connect() {
    const url = `${serverUrl}?role=runner&token=${encodeURIComponent(token)}&runnerId=${runnerId}&name=${encodeURIComponent(name)}`
    const ws = new WebSocket(url)

    ws.on('open', () => {
      if (!firstConnect) console.log('[runner] reconnected')
      firstConnect = false
      resolveReady()
    })

    ws.on('message', async (raw) => {
      let msg
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }
      if (msg.type !== 'request') return

      const handler = actions[msg.action]
      if (!handler) {
        ws.send(JSON.stringify({ type: 'response', requestId: msg.requestId, ok: false, error: `Unknown action: ${msg.action}` }))
        return
      }
      try {
        const data = await handler(msg.payload || {})
        ws.send(JSON.stringify({ type: 'response', requestId: msg.requestId, ok: true, data }))
      } catch (err) {
        ws.send(JSON.stringify({ type: 'response', requestId: msg.requestId, ok: false, error: err.message }))
      }
    })

    ws.on('close', () => {
      setTimeout(connect, 3000)
    })

    ws.on('error', () => {
      // 'close' follows and triggers the reconnect above
    })
  }

  connect()
  return ready
}
