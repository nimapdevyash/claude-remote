const isTTY = process.stdout.isTTY

function style(code, text) {
  return isTTY ? `[${code}m${text}[0m` : text
}
const dim = (t) => style(2, t)
const bold = (t) => style(1, t)
const green = (t) => style(32, t)
const red = (t) => style(31, t)
const accent = (t) => style(35, t)

const TOOL_SUMMARY = {
  Bash: (i) => i.command,
  Read: (i) => i.file_path,
  Edit: (i) => i.file_path,
  Write: (i) => i.file_path,
  Glob: (i) => i.pattern,
  Grep: (i) => i.pattern,
  WebFetch: (i) => i.url,
  WebSearch: (i) => i.query,
  remote_bash: (i) => i.command,
  remote_read_file: (i) => i.path,
  remote_write_file: (i) => i.path,
  remote_edit_file: (i) => i.path,
  remote_list_dir: (i) => i.path || '.',
}

function toolLabel(name) {
  return name.startsWith('mcp__remote__') ? name.slice('mcp__remote__'.length) : name
}

function toolSummary(name, input) {
  const shortName = toolLabel(name)
  const value = TOOL_SUMMARY[shortName]?.(input || {})
  if (value) return value
  try {
    return JSON.stringify(input)
  } catch {
    return ''
  }
}

function stringifyToolResult(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((c) => c?.text ?? JSON.stringify(c)).join('\n')
  return JSON.stringify(content)
}

function truncate(text, max = 400) {
  const clean = text.trim()
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

// Creates a stateful printer for one turn's stream of raw claude-code
// events, rendering them incrementally in the same visual style as the
// real `claude` CLI (● Tool: summary lines, plain assistant text).
export function createTurnPrinter() {
  const pendingByToolId = new Map()

  return function handleEvent(event) {
    if (event.type === 'assistant' && Array.isArray(event.message?.content)) {
      for (const part of event.message.content) {
        if (part.type === 'text' && part.text) {
          console.log(`\n${part.text}`)
        } else if (part.type === 'tool_use') {
          pendingByToolId.set(part.id, part)
          console.log(`${accent('●')} ${bold(toolLabel(part.name))}: ${dim(toolSummary(part.name, part.input))}`)
        }
      }
    } else if (event.type === 'user' && Array.isArray(event.message?.content)) {
      for (const part of event.message.content) {
        if (part.type === 'tool_result' && part.is_error) {
          const tool = pendingByToolId.get(part.tool_use_id)
          const label = tool ? toolLabel(tool.name) : 'tool'
          console.log(`  ${red('✗')} ${label} failed: ${truncate(stringifyToolResult(part.content))}`)
        }
      }
    } else if (event.type === 'result') {
      const bits = []
      if (typeof event.total_cost_usd === 'number') bits.push(`$${event.total_cost_usd.toFixed(4)}`)
      if (typeof event.duration_ms === 'number') bits.push(`${(event.duration_ms / 1000).toFixed(1)}s`)
      if (event.num_turns != null) bits.push(`${event.num_turns} turn${event.num_turns === 1 ? '' : 's'}`)
      console.log(`\n${dim(bits.join(' · '))}\n`)
    } else if (event.type === 'raw_text') {
      console.log(red(event.text))
    }
  }
}

export function printBanner({ name, root, sessionId }) {
  console.log(`\n${bold('claude-remote')} — connected as ${accent(`"${name}"`)}`)
  console.log(`${dim('root:')} ${root}`)
  console.log(`${dim('session:')} ${sessionId}`)
  console.log(dim('\nType a task and press Enter. Ctrl+C or "exit" to quit.\n'))
}

export function printError(message) {
  console.log(red(message))
}

export { green, dim }
