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
   Highwayman server  ──spawns──▶  `claude` (this machine's login)
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

## File uploads

`POST /api/sessions/:id/uploads` (multipart, one file per request) is the
one piece of the API that doesn't go through the `claude` process at all
— it just needs the bytes to land on whichever filesystem the session
targets, in `.highwayman-uploads/<sessionId>/`, before the next turn
starts:

- **Local session** — written directly with `fs.writeFileSync`, through
  the same `resolveWorkspacePath` guard every other local-filesystem route
  uses.
- **Runner-targeted session** — sent straight to `runnerHub.sendRequest`
  as a `write_file` action, base64-encoded (`{ encoding: 'base64' }`).
  This is the *same* action Claude's own `remote_write_file` MCP tool
  calls — the runner-side handler in `runner/src/actions.js` just also
  accepts an optional `encoding` now, decoding to a `Buffer` instead of
  assuming UTF-8 text. No new request/response path, no new runner code
  path to trust.

Either way, the response is a path — absolute for local, relative to the
runner's root for a runner target — meant to be typed or pasted into the
next prompt so Claude's Read tool (or `remote_read_file`) picks it up
exactly like any other file reference. See [Web UI](/guide/web-ui) and
[Runner CLI](/guide/runner-cli) for the two ways a path actually gets
there.

## Server status

`GET /api/status` reports the server machine's own battery (via
`server/src/battery.js` — reads `/sys/class/power_supply` on Linux,
shells out to `pmset`/PowerShell on macOS/Windows, and returns
`hasBattery: false` on a desktop with none). The runner CLI polls it to
show a `🔋 82% (charging)`-style line, since the server machine — the one
holding your Claude Code login — is often a laptop you'd want a warning
about running low mid-task.

## Why not just SSH?

MCP is the extension point Claude Code actually exposes for adding tools —
using it (rather than, say, wrapping the whole CLI over SSH) means the
`remote_*` tools show up to Claude exactly like any other tool: named,
described, individually allow-listed, and visible in the same stream-json
event shape as `Bash`/`Read`/`Write`/`Edit` would be. Nothing about the
event parsing, persistence, or UI rendering needs to know or care whether
a given tool call happened locally or on a runner three rooms away.
