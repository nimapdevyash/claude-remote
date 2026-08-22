#!/usr/bin/env node
// Stdio MCP server spawned by `claude` itself (via --mcp-config) for
// runner-targeted sessions. Each tool call is forwarded over HTTP to this
// Highwayman server's internal API, which relays it to the connected
// runner CLI on the remote machine and waits for the result.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const { RUNNER_ID, SERVER_PORT, INTERNAL_TOKEN } = process.env
if (!RUNNER_ID || !SERVER_PORT || !INTERNAL_TOKEN) {
  console.error('mcpBridge: missing RUNNER_ID, SERVER_PORT, or INTERNAL_TOKEN env vars')
  process.exit(1)
}

const baseUrl = `http://127.0.0.1:${SERVER_PORT}/internal/runner/${RUNNER_ID}`

async function callInternal(action, body) {
  const res = await fetch(`${baseUrl}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    body: JSON.stringify(body),
  })
  let json
  try {
    json = await res.json()
  } catch {
    throw new Error(`Bridge request failed: ${res.status} ${res.statusText}`)
  }
  if (!res.ok || !json.ok) {
    throw new Error(json.error || `Bridge request failed: ${res.status}`)
  }
  return json.data
}

function textResult(text, isError = false) {
  return { content: [{ type: 'text', text }], isError }
}

async function safeCall(fn) {
  try {
    return await fn()
  } catch (err) {
    return textResult(err.message, true)
  }
}

const server = new McpServer({ name: 'remote', version: '1.0.0' })

server.tool(
  'remote_bash',
  'Run a shell command on the REMOTE machine (not this one). Use this instead of Bash for any command execution.',
  { command: z.string().describe('Shell command to run'), cwd: z.string().optional().describe('Working directory, relative to the remote root') },
  async ({ command, cwd }) =>
    safeCall(async () => {
      const data = await callInternal('exec', { command, cwd })
      const text = [data.stdout, data.stderr].filter(Boolean).join('\n').trim() || '(no output)'
      return textResult(text, Boolean(data.exitCode))
    }),
)

server.tool(
  'remote_read_file',
  'Read a file from the REMOTE machine. Use this instead of Read for any file access.',
  { path: z.string().describe('File path, relative to the remote root') },
  async ({ path }) =>
    safeCall(async () => {
      const data = await callInternal('read', { path })
      return textResult(data.content)
    }),
)

server.tool(
  'remote_write_file',
  'Write (create or overwrite) a file on the REMOTE machine. Use this instead of Write.',
  {
    path: z.string().describe('File path, relative to the remote root'),
    content: z.string().describe('Full file content to write'),
  },
  async ({ path, content }) =>
    safeCall(async () => {
      await callInternal('write', { path, content })
      return textResult(`Wrote ${content.length} bytes to ${path}`)
    }),
)

server.tool(
  'remote_edit_file',
  'Replace an exact string match inside a file on the REMOTE machine. Use this instead of Edit.',
  {
    path: z.string().describe('File path, relative to the remote root'),
    old_string: z.string().describe('Exact text to replace'),
    new_string: z.string().describe('Replacement text'),
    replace_all: z.boolean().optional().describe('Replace every occurrence instead of requiring exactly one'),
  },
  async ({ path, old_string, new_string, replace_all }) =>
    safeCall(async () => {
      await callInternal('edit', { path, old_string, new_string, replace_all })
      return textResult(`Edited ${path}`)
    }),
)

server.tool(
  'remote_list_dir',
  'List subdirectories under a path on the REMOTE machine. Use this instead of Glob/Bash(ls) to explore directories.',
  { path: z.string().optional().describe('Directory path, relative to the remote root (default: root)') },
  async ({ path }) =>
    safeCall(async () => {
      const data = await callInternal('list', { path: path || '' })
      return textResult(JSON.stringify(data, null, 2))
    }),
)

const transport = new StdioServerTransport()
await server.connect(transport)
