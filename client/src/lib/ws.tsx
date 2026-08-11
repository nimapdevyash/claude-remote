import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { WsMessage } from '../types/api'
import { getToken } from './api'

type Listener = (msg: WsMessage) => void

type WsContextValue = {
  connected: boolean
  subscribe: (sessionId: string, listener: Listener) => () => void
}

const WsContext = createContext<WsContextValue | null>(null)

export function WsProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false)
  const listenersRef = useRef(new Map<string, Set<Listener>>())
  const activeSessionRef = useRef<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    let cancelled = false
    let retryDelay = 1000
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      const token = getToken()
      if (!token || cancelled) return
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const socket = new WebSocket(`${protocol}://${window.location.host}/ws?token=${encodeURIComponent(token)}`)
      wsRef.current = socket

      socket.onopen = () => {
        retryDelay = 1000
        setConnected(true)
        if (activeSessionRef.current) {
          socket.send(JSON.stringify({ type: 'subscribe', sessionId: activeSessionRef.current }))
        }
      }
      socket.onmessage = (evt) => {
        let msg: WsMessage
        try {
          msg = JSON.parse(evt.data)
        } catch {
          return
        }
        listenersRef.current.get((msg as any).sessionId)?.forEach((fn) => fn(msg))
      }
      socket.onclose = () => {
        setConnected(false)
        if (cancelled) return
        retryTimer = setTimeout(connect, retryDelay)
        retryDelay = Math.min(retryDelay * 1.6, 15000)
      }
      socket.onerror = () => {
        socket.close()
      }
    }

    connect()

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      wsRef.current?.close()
    }
  }, [])

  const value = useMemo<WsContextValue>(
    () => ({
      connected,
      subscribe(sessionId, listener) {
        activeSessionRef.current = sessionId
        if (!listenersRef.current.has(sessionId)) listenersRef.current.set(sessionId, new Set())
        listenersRef.current.get(sessionId)!.add(listener)

        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'subscribe', sessionId }))
        }

        return () => {
          listenersRef.current.get(sessionId)?.delete(listener)
        }
      },
    }),
    [connected],
  )

  return <WsContext.Provider value={value}>{children}</WsContext.Provider>
}

export function useWs() {
  const ctx = useContext(WsContext)
  if (!ctx) throw new Error('useWs must be used within WsProvider')
  return ctx
}
