export type SessionTarget = { type: 'local' } | { type: 'runner'; runnerId: string }

export type SessionSummary = {
  id: string
  name: string
  cwd: string
  target: SessionTarget
  model: string | null
  permissionMode: string
  status: 'idle' | 'running'
  createdAt: number
  updatedAt: number
  lastPrompt: string | null
  turnCount: number
}

export type RunnerInfo = {
  id: string
  name: string
  connectedAt: number
}

// Raw JSON-line event emitted by `claude -p --output-format stream-json`.
export type ClaudeEvent = Record<string, any>

export type Turn = {
  id: string
  prompt: string
  createdAt: number
  status: 'running' | 'completed' | 'failed'
  exitCode: number | null
  stderr: string | null
  events: ClaudeEvent[]
  result: ClaudeEvent | null
}

export type SessionDetail = SessionSummary & {
  claudeSessionId: string | null
  turns: Turn[]
}

export type WsMessage =
  | { type: 'turn_started'; sessionId: string; turnId: string; prompt: string }
  | { type: 'claude_event'; sessionId: string; turnId: string; event: ClaudeEvent }
  | {
      type: 'turn_finished'
      sessionId: string
      turnId: string
      status: 'completed' | 'failed'
      exitCode: number | null
      stderr: string | null
    }

export type BrowseResult = {
  root: string
  path: string
  parent: string | null
  dirs: string[]
}
