export function relativeTime(ts: number): string {
  const seconds = Math.round((Date.now() - ts) / 1000)
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export function formatCost(usd: number): string {
  return `$${usd.toFixed(usd < 0.01 ? 4 : 2)}`
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const TOOL_SUMMARY: Record<string, (input: any) => string | undefined> = {
  Bash: (i) => i.command,
  Read: (i) => i.file_path,
  Edit: (i) => i.file_path,
  Write: (i) => i.file_path,
  Glob: (i) => i.pattern,
  Grep: (i) => i.pattern,
  WebFetch: (i) => i.url,
  WebSearch: (i) => i.query,
  Task: (i) => i.description,
}

export function toolSummary(name: string, input: any): string {
  const value = TOOL_SUMMARY[name]?.(input || {})
  if (value) return value
  try {
    return JSON.stringify(input)
  } catch {
    return ''
  }
}
