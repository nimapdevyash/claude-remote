# Architecture

## Local sessions

A session pins a workspace folder (under the server's `WORKSPACE_ROOT`)
and a permission mode. Sending a message spawns:

```
claude -p "<prompt>" --output-format stream-json --verbose [--resume <id>]
```

in that folder. Every JSON line it prints — `system/init`, `assistant`
(text and `tool_use` blocks), `user` (`tool_result` blocks), and the final
`result` — is parsed, persisted to `server/data/db.json`, and broadcast
over `/ws` to any client subscribed to that session. The `session_id` from
the first turn's `system/init` event is stored and passed back via
`--resume` on later turns, so a session is a real multi-turn conversation.

## Runner-targeted sessions

This is the interesting case: `claude` still runs on the **server's**
machine — that's where the login lives — but its filesystem/shell tools
are rerouted to a different machine entirely.

1. The server spawns `claude` with `--mcp-config` pointing at
   `server/src/mcpBridge.js`, a small stdio MCP server, plus
   `--disallowedTools Bash,Read,Write,Edit,Glob,Grep,NotebookEdit` and
   `--allowedTools` pre-approving exactly the five `remote_*` tools that
   bridge exposes.
2. When Claude calls one of those tools, the bridge makes an HTTP request
   to the server's **internal API** — loopback-only, guarded by a
   per-boot random token, never reachable from the browser.
3. `runnerHub.js` forwards that as `{action, payload}` over the target
   runner's WebSocket connection and waits for the matching
   `{type: 'response', requestId, ...}` — the same request/response
   correlation pattern either a browser tab or the runner CLI's chat mode
   uses to subscribe to a session's events.
4. The runner executes the action (`exec`, `read_file`, `write_file`,
   `edit_file`, or `list_dir`) confined to its own configured root, and
   replies.

```
Web browser / runner CLI (chat mode)
        │  REST: create session, send message
        │  WS:   subscribe → live turn/tool-call/result events
        ▼
   claude-remote server  ──spawns──▶  `claude` (this machine's login)
        │  ▲                                │ MCP tool_use
        │  │ internal HTTP (loopback-only)   ▼
        │  └──────────────────────  mcpBridge.js (stdio MCP server)
        │
        │  WS: {action, payload} ──▶ request/response over runnerHub
        ▼
   runner CLI (executor) ── exec/read/write/edit/list, confined to ROOT
```

Both cases end up writing to the exact same `turns[].events` shape and
broadcasting over the exact same WebSocket protocol — which is why a
browser tab and the runner CLI's own chat prompt can watch (or drive) the
identical session without either one being a special case.

## Why not just SSH?

MCP is the extension point Claude Code actually exposes for adding tools —
using it (rather than, say, wrapping the whole CLI over SSH) means the
`remote_*` tools show up to Claude exactly like any other tool: named,
described, individually allow-listed, and visible in the same stream-json
event shape as `Bash`/`Read`/`Write`/`Edit` would be. Nothing about the
event parsing, persistence, or UI rendering needs to know or care whether
a given tool call happened locally or on a runner three rooms away.
