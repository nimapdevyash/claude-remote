const isTTY = process.stdout.isTTY

const ESC = String.fromCharCode(27)
function style(code, text) {
  return isTTY ? `${ESC}[${code}m${text}${ESC}[0m` : text
}
const dim = (t) => style(2, t)
const bold = (t) => style(1, t)
const green = (t) => style(32, t)
const red = (t) => style(31, t)
const yellow = (t) => style(33, t)
const blue = (t) => style(34, t)
const accent = (t) => style(35, t)
const cyan = (t) => style(36, t)

// Strips SGR escape sequences so box/table padding measures the actual
// printable width of an already-styled string, not its raw character count.
function visibleLength(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '').length
}

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

// --- Shared "design system" for the CLI's terminal output -----------------
//
// Modeled on nala's terminal aesthetic: rounded-border panels and tables
// for anything that's genuinely structured (connection info, account
// lists), rather than every line getting its own decoration — loose
// status lines stay plain and colored so the boxed panels keep standing
// out as "the important thing to read right now."

const RULE_WIDTH = 52
const BOX = { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│', ml: '├', mr: '┤', mm: '┼' }

export function printHeader(title) {
  console.log(`\n${bold(accent(`◆ ${title}`))}`)
}

// A single rounded panel with the title inlined into the top border, e.g.
//   ╭─ claude-remote ──────────────╮
//   │ connected as  "yashs-laptop" │
//   ╰───────────────────────────────╯
// `lines` may already contain ANSI styling — width is measured on the
// visible text only, so colored values still line up.
export function printBox(title, lines, { color = accent, minWidth = RULE_WIDTH } = {}) {
  const contentWidth = Math.max(minWidth, ...lines.map(visibleLength))
  const titleLabel = ` ${title} `
  const fill = Math.max(0, contentWidth + 1 - visibleLength(titleLabel))
  console.log(color(BOX.tl + BOX.h) + bold(color(titleLabel)) + color(BOX.h.repeat(fill)) + color(BOX.tr))
  for (const line of lines) {
    const pad = ' '.repeat(Math.max(0, contentWidth - visibleLength(line)))
    console.log(`${color(BOX.v)} ${line}${pad} ${color(BOX.v)}`)
  }
  console.log(color(BOX.bl + BOX.h.repeat(contentWidth + 2) + BOX.br))
}

// A bordered table with a header row, e.g.
//   ╭──────────┬───────╮
//   │ Username │ Role  │
//   ├──────────┼───────┤
//   │ yash     │ admin │
//   ╰──────────┴───────╯
export function printTable(headers, rows, { color = accent } = {}) {
  const widths = headers.map((h, i) =>
    Math.max(visibleLength(h), ...rows.map((r) => visibleLength(String(r[i] ?? '')))),
  )
  const border = (l, m, r) => color(l) + widths.map((w) => color(BOX.h.repeat(w + 2))).join(color(m)) + color(r)
  const row = (cells, cellStyle = (s) => s) =>
    color(BOX.v) +
    cells
      .map((c, i) => {
        const text = String(c ?? '')
        return ` ${cellStyle(text)}${' '.repeat(widths[i] - visibleLength(text))} `
      })
      .join(color(BOX.v)) +
    color(BOX.v)

  console.log(border(BOX.tl, '┬', BOX.tr))
  console.log(row(headers, (s) => bold(s)))
  console.log(border(BOX.ml, BOX.mm, BOX.mr))
  for (const r of rows) console.log(row(r))
  console.log(border(BOX.bl, '┴', BOX.br))
}

export const PROMPT_SYMBOL = `${bold(accent('❯'))} `

// Each entry: { usage, description, example? } — used by --help to show
// what a command does and a concrete, copy-pasteable example, not just a
// bare usage string.
export function printCommandHelp(entries) {
  for (const { usage, description, example } of entries) {
    console.log(`  ${bold(usage)}`)
    console.log(`    ${dim(description)}`)
    if (example) console.log(`    ${dim('$')} ${accent(example)}`)
    console.log()
  }
}

// --- "Thinking" spinner ----------------------------------------------------

// The real `claude` CLI fills the gap between your prompt and its first
// token with an animated status line — a spinner, a random present-participle
// verb, and an elapsed timer — so it's visually obvious it's working, not
// hung. This is the same idea, redrawn in place on one line.
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const THINKING_WORDS = [
  'Pondering', 'Noodling', 'Percolating', 'Marinating', 'Ruminating',
  'Contemplating', 'Cogitating', 'Puzzling', 'Deliberating', 'Mulling',
  'Synthesizing', 'Conjuring', 'Scheming', 'Wrangling', 'Untangling',
  'Divining', 'Churning', 'Brewing',
]

export function createSpinner() {
  let timer = null
  let frame = 0
  let startedAt = 0
  let word = THINKING_WORDS[0]
  let active = false

  function render() {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000)
    const line = `${yellow(SPINNER_FRAMES[frame % SPINNER_FRAMES.length])} ${dim(`${word}… (${elapsed}s)`)}`
    process.stdout.write(`\r\x1b[K${line}`)
    frame++
  }

  return {
    start() {
      if (active || !isTTY) return
      active = true
      startedAt = Date.now()
      word = THINKING_WORDS[Math.floor(Math.random() * THINKING_WORDS.length)]
      frame = 0
      render()
      timer = setInterval(render, 120)
    },
    stop() {
      if (!active) return
      active = false
      clearInterval(timer)
      timer = null
      process.stdout.write('\r\x1b[K')
    },
  }
}

// --- Turn/event rendering --------------------------------------------------

// Creates a stateful printer for one turn's stream of raw claude-code
// events, rendering them incrementally in the same visual style as the
// real `claude` CLI (● Tool: summary lines, ◆-marked assistant text). Each
// kind of line gets its own color — magenta ❯ for your own prompt, cyan ◆
// for Claude's text, yellow ● for a tool in flight, red ✗ for a failure —
// so the left margin alone tells you who's "talking" on any given line,
// the same multi-hue-by-role language nala uses (green for new packages,
// yellow for upgrades, red for removals). `spinner` (optional) is paused
// for the instant a line is printed and resumed right after, so it never
// overlaps output.
export function createTurnPrinter(spinner) {
  const pendingByToolId = new Map()

  return function handleEvent(event) {
    spinner?.stop()

    if (event.type === 'assistant' && Array.isArray(event.message?.content)) {
      for (const part of event.message.content) {
        if (part.type === 'text' && part.text) {
          console.log(`\n${bold(cyan('◆'))} ${part.text}`)
        } else if (part.type === 'tool_use') {
          pendingByToolId.set(part.id, part)
          console.log(`${yellow('●')} ${bold(toolLabel(part.name))}: ${dim(toolSummary(part.name, part.input))}`)
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
      console.log(`\n${green('✓')} ${dim(bits.join(' · '))}\n`)
    } else if (event.type === 'raw_text') {
      console.log(red(event.text))
    }

    if (event.type !== 'result') spinner?.start()
  }
}

export function printBanner({ name, root, sessionId, serverUrl, overrideSource }) {
  const serverLine = overrideSource ? `${serverUrl}  ${dim(`(via ${overrideSource})`)}` : serverUrl
  const rows = [
    ['connected as', accent(`"${name}"`)],
    ['server', serverLine],
    ['root', root],
    ['session', dim(sessionId)],
  ]
  const labelWidth = Math.max(...rows.map(([label]) => label.length))
  const lines = rows.map(([label, value]) => `${dim(label.padEnd(labelWidth))}  ${value}`)
  console.log()
  printBox('claude-remote', lines)
  console.log(dim('\nType a task and press Enter.  Ctrl+C or "exit" to quit.\n'))
}

export function printError(message) {
  console.log(red(message))
}

export function printSuccess(message) {
  console.log(green(message))
}

export { green, red, dim, bold, accent, cyan, yellow, blue }
