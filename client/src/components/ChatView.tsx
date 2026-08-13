import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, HardDrive, Loader2, Radio, Square } from 'lucide-react'
import { api } from '../lib/api'
import { useWs } from '../lib/ws'
import type { SessionDetail, Turn, WsMessage } from '../types/api'
import { deriveBlocks } from '../lib/deriveBlocks'
import { UserBubble, AssistantText } from './MessageBubble'
import { ToolCallCard } from './ToolCallCard'
import { Composer } from './Composer'
import { formatCost, formatDuration } from '../lib/format'

function applyWsMessage(session: SessionDetail, msg: WsMessage): SessionDetail {
  if (msg.type === 'turn_started') {
    if (session.turns.some((t) => t.id === msg.turnId)) return session
    const turn: Turn = {
      id: msg.turnId,
      prompt: msg.prompt,
      createdAt: Date.now(),
      status: 'running',
      exitCode: null,
      stderr: null,
      events: [],
      result: null,
    }
    return { ...session, status: 'running', turns: [...session.turns, turn] }
  }
  if (msg.type === 'claude_event') {
    return {
      ...session,
      turns: session.turns.map((t) =>
        t.id === msg.turnId
          ? { ...t, events: [...t.events, msg.event], result: msg.event.type === 'result' ? msg.event : t.result }
          : t,
      ),
    }
  }
  if (msg.type === 'turn_finished') {
    return {
      ...session,
      status: 'idle',
      turns: session.turns.map((t) =>
        t.id === msg.turnId ? { ...t, status: msg.status, exitCode: msg.exitCode, stderr: msg.stderr } : t,
      ),
    }
  }
  return session
}

type Props = {
  sessionId: string
  onActivity?: () => void
}

export function ChatView({ sessionId, onActivity }: Props) {
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [runnerName, setRunnerName] = useState<string | null>(null)
  const { subscribe } = useWs()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSession(null)
    setLoadError(null)
    setRunnerName(null)
    api
      .getSession(sessionId)
      .then((detail) => {
        setSession(detail)
        const { target } = detail
        if (target.type === 'runner') {
          api
            .listRunners()
            .then((runners) => setRunnerName(runners.find((r) => r.id === target.runnerId)?.name ?? null))
            .catch(() => {})
        }
      })
      .catch(() => setLoadError('Could not load this session.'))
  }, [sessionId])

  useEffect(() => {
    return subscribe(sessionId, (msg) => {
      setSession((s) => (s && s.id === sessionId ? applyWsMessage(s, msg) : s))
      if (msg.type === 'turn_started' || msg.type === 'turn_finished') onActivity?.()
    })
  }, [sessionId, subscribe, onActivity])

  const totalEvents = session?.turns.reduce((sum, t) => sum + t.events.length, 0) ?? 0
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [session?.turns.length, totalEvents])

  async function handleSend(prompt: string) {
    setSendError(null)
    try {
      await api.sendMessage(sessionId, prompt)
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Failed to send message')
    }
  }

  async function handleStop() {
    try {
      await api.stopTurn(sessionId)
    } catch {
      // likely already finished
    }
  }

  if (loadError) {
    return <div className="flex flex-1 items-center justify-center text-sm text-bad-500">{loadError}</div>
  }
  if (!session) {
    return (
      <div className="flex flex-1 items-center justify-center text-base-500">
        <Loader2 className="animate-spin" size={20} />
      </div>
    )
  }

  const running = session.status === 'running'

  return (
    <div className="flex h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-base-800 px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold text-base-50">{session.name}</h2>
          <p className="font-mono text-xs text-base-500">{session.cwd || '~'}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 rounded-full bg-base-800 px-2.5 py-1 text-xs font-medium text-base-300">
            {session.target.type === 'runner' ? (
              <>
                <Radio size={11} className="text-good-500" />
                {runnerName || 'runner'}
              </>
            ) : (
              <>
                <HardDrive size={11} />
                this server
              </>
            )}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              running ? 'bg-good-500/15 text-good-500' : 'bg-base-800 text-base-400'
            }`}
          >
            {running ? 'Running' : 'Idle'}
          </span>
          {running && (
            <button
              onClick={handleStop}
              className="flex items-center gap-1.5 rounded-lg border border-base-700 px-3 py-1.5 text-xs font-medium text-base-300 transition hover:border-bad-500/50 hover:text-bad-500"
            >
              <Square size={12} />
              Stop
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {session.turns.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center text-base-500">
            <p className="text-sm">Send a task to get started.</p>
            <p className="mt-1 max-w-sm text-xs">
              Claude Code will run in <code className="rounded bg-base-800 px-1 font-mono">{session.cwd || '~'}</code>
            </p>
          </div>
        )}

        <div className="space-y-6">
          {session.turns.map((turn) => {
            const blocks = deriveBlocks(turn.events)
            return (
              <div key={turn.id} className="space-y-3">
                <UserBubble text={turn.prompt} />
                {blocks.map((block) =>
                  block.kind === 'text' ? (
                    <AssistantText key={block.id} text={block.text} />
                  ) : block.kind === 'tool' ? (
                    <ToolCallCard key={block.id} block={block} />
                  ) : (
                    <pre
                      key={block.id}
                      className="max-w-2xl overflow-x-auto rounded-lg bg-bad-500/10 p-3 font-mono text-xs text-bad-500"
                    >
                      {block.text}
                    </pre>
                  ),
                )}
                {turn.status === 'running' && (
                  <div className="flex items-center gap-2 text-xs text-base-500">
                    <Loader2 size={13} className="animate-spin" />
                    Claude is working…
                  </div>
                )}
                {turn.status === 'failed' && turn.stderr && (
                  <div className="flex max-w-2xl items-start gap-2 rounded-lg border border-bad-500/30 bg-bad-500/10 px-3 py-2 text-xs text-bad-500">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span className="whitespace-pre-wrap break-all">{turn.stderr}</span>
                  </div>
                )}
                {turn.result && (
                  <p className="text-[11px] text-base-600">
                    {[
                      typeof turn.result.total_cost_usd === 'number' && formatCost(turn.result.total_cost_usd),
                      typeof turn.result.duration_ms === 'number' && formatDuration(turn.result.duration_ms),
                      turn.result.num_turns != null &&
                        `${turn.result.num_turns} turn${turn.result.num_turns === 1 ? '' : 's'}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {sendError && <p className="px-6 pb-1 text-xs text-bad-500">{sendError}</p>}
      <Composer disabled={running} sessionId={sessionId} onSend={handleSend} />
    </div>
  )
}
