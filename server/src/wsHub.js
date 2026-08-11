const rooms = new Map() // sessionId -> Set<WebSocket>

export const wsHub = {
  join(sessionId, ws) {
    if (!rooms.has(sessionId)) rooms.set(sessionId, new Set())
    rooms.get(sessionId).add(ws)
  },
  leave(sessionId, ws) {
    rooms.get(sessionId)?.delete(ws)
  },
  leaveAll(ws) {
    for (const set of rooms.values()) set.delete(ws)
  },
  broadcast(sessionId, payload) {
    const set = rooms.get(sessionId)
    if (!set || set.size === 0) return
    const data = JSON.stringify(payload)
    for (const ws of set) {
      if (ws.readyState === ws.OPEN) ws.send(data)
    }
  },
}
