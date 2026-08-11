import { nanoid } from 'nanoid'

const runners = new Map() // runnerId -> { ws, name, connectedAt }
const pending = new Map() // requestId -> { resolve, reject, timer }

const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000

export const runnerHub = {
  register(runnerId, name, ws) {
    const existing = runners.get(runnerId)
    if (existing && existing.ws !== ws && existing.ws.readyState === existing.ws.OPEN) {
      existing.ws.close(4000, 'replaced by new connection')
    }
    runners.set(runnerId, { ws, name, connectedAt: Date.now() })
  },

  unregister(runnerId, ws) {
    const existing = runners.get(runnerId)
    if (existing && existing.ws === ws) {
      runners.delete(runnerId)
    }
  },

  isConnected(runnerId) {
    const r = runners.get(runnerId)
    return Boolean(r && r.ws.readyState === r.ws.OPEN)
  },

  list() {
    return Array.from(runners.entries()).map(([id, r]) => ({
      id,
      name: r.name,
      connectedAt: r.connectedAt,
    }))
  },

  // Sends {type:'request', requestId, action, payload} to the runner and
  // resolves/rejects when the matching {type:'response', requestId} arrives.
  sendRequest(runnerId, action, payload, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const runner = runners.get(runnerId)
    if (!runner || runner.ws.readyState !== runner.ws.OPEN) {
      return Promise.reject(new Error('Runner is not connected'))
    }

    const requestId = nanoid(12)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(requestId)
        reject(new Error('Runner request timed out'))
      }, timeoutMs)

      pending.set(requestId, { resolve, reject, timer })
      runner.ws.send(JSON.stringify({ type: 'request', requestId, action, payload }))
    })
  },

  // Called by the WS layer when a runner sends back {type:'response', ...}
  handleResponse(msg) {
    const entry = pending.get(msg.requestId)
    if (!entry) return
    pending.delete(msg.requestId)
    clearTimeout(entry.timer)
    if (msg.ok) {
      entry.resolve(msg.data)
    } else {
      entry.reject(new Error(msg.error || 'Runner request failed'))
    }
  },
}
