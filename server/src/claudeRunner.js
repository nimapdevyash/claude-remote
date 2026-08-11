import { spawn } from 'child_process'
import path from 'path'
import readline from 'readline'
import { fileURLToPath } from 'url'
import { config } from './config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MCP_BRIDGE_PATH = path.join(__dirname, 'mcpBridge.js')

const REMOTE_TOOLS = ['remote_bash', 'remote_read_file', 'remote_write_file', 'remote_edit_file', 'remote_list_dir']
const LOCAL_FS_TOOLS = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'NotebookEdit']

function buildRunnerArgs(target, remoteCwd) {
  const mcpConfig = {
    mcpServers: {
      remote: {
        command: 'node',
        args: [MCP_BRIDGE_PATH],
        env: {
          RUNNER_ID: target.runnerId,
          SERVER_PORT: String(config.port),
          INTERNAL_TOKEN: config.internalToken,
        },
      },
    },
  }

  return [
    '--mcp-config',
    JSON.stringify(mcpConfig),
    '--strict-mcp-config',
    '--disallowedTools',
    LOCAL_FS_TOOLS.join(','),
    '--allowedTools',
    REMOTE_TOOLS.map((t) => `mcp__remote__${t}`).join(','),
    '--append-system-prompt',
    `You are controlling a REMOTE machine's filesystem and shell through the ${REMOTE_TOOLS.join(', ')} tools — you have no local filesystem or Bash access in this session, so use those tools instead of Bash/Read/Write/Edit/Glob/Grep. All paths passed to them are relative to that remote machine's configured root. The user's requested working directory there is: ${remoteCwd || '(root)'}.`,
  ]
}

// Spawns `claude -p <prompt> --output-format stream-json` and streams parsed
// JSON-line events back via onEvent. Returns the child process so callers can
// kill() it to cancel a running turn. For a runner target, the spawned
// `claude` process itself runs locally (this machine holds the Claude Code
// login), but its filesystem/shell tools are rerouted over MCP to the
// connected runner CLI on the remote machine.
export function runClaudeTurn({
  cwd,
  prompt,
  resumeSessionId,
  permissionMode,
  model,
  target = { type: 'local' },
  onEvent,
  onExit,
}) {
  const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose']

  let spawnCwd = cwd
  if (target.type === 'runner') {
    args.push(...buildRunnerArgs(target, cwd))
    spawnCwd = config.workspaceRoot
  } else if (permissionMode) {
    args.push('--permission-mode', permissionMode)
  }

  if (resumeSessionId) args.push('--resume', resumeSessionId)
  if (model) args.push('--model', model)

  const child = spawn('claude', args, { cwd: spawnCwd, env: process.env })

  const rl = readline.createInterface({ input: child.stdout })
  rl.on('line', (line) => {
    if (!line.trim()) return
    try {
      onEvent(JSON.parse(line))
    } catch {
      onEvent({ type: 'raw_text', text: line })
    }
  })

  let stderrBuf = ''
  child.stderr.on('data', (chunk) => {
    stderrBuf += chunk.toString()
  })

  child.on('close', (code) => {
    onExit(code, stderrBuf.trim() || null)
  })

  child.on('error', (err) => {
    onExit(-1, err.message)
  })

  return child
}
