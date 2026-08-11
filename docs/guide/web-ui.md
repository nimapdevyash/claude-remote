# Web UI

The web UI is a chat-style client for Claude Code: every session is a
persistent multi-turn conversation, rendered as a feed of user prompts,
assistant text, and expandable tool-call cards.

## Signing in

Sign-in is username/password (see [Auth & security](/guide/security)), not
a token you paste around. Successful login stores a session token in
`localStorage` and reuses it until it expires or you sign out.

## Sessions

A session pins:

- A **target** — either this server's own filesystem, or a connected
  [runner](/guide/runner-cli) on another machine
- A **folder** inside that target, browsed with a folder picker rooted at
  either `WORKSPACE_ROOT` (local) or the runner's configured root
- A **permission mode** (local sessions only — runner-targeted sessions
  pre-approve their five `remote_*` tools instead, see
  [Architecture](/guide/architecture))

Once created, sending a message spawns (or resumes) a `claude -p` turn.
Everything it prints streams live over a WebSocket to every browser tab
subscribed to that session — open it on your phone and your laptop at the
same time and both update identically.

## Reading the feed

- **Assistant text** renders as markdown, with syntax-highlighted code
  blocks.
- **Tool calls** appear as collapsible cards: a status dot (pending →
  success/error), a one-line summary (e.g. the command, or the file
  path), and an expandable view of the full input/result JSON.
- A footer line after each turn shows cost, duration, and turn count from
  Claude Code's own `result` event.

## Stopping a turn

The **Stop** button in the session header sends `SIGINT` to the
underlying `claude` process for that turn.
