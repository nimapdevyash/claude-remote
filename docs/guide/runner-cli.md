# Runner CLI

The runner CLI is what makes claude-remote feel like Claude Code is
running on whichever machine you're sitting at — even though the actual
model calls happen on the server's machine (the one with your Claude Code
login).

## Install

**macOS / Linux:**

```bash
curl -fsSL https://raw.githubusercontent.com/nimapdevyash/claude-remote/main/install.sh | bash
```

**Windows (PowerShell):**

```powershell
iwr https://raw.githubusercontent.com/nimapdevyash/claude-remote/main/install.ps1 -useb | iex
```

Both scripts detect your OS, check for Node.js 18+, fetch the CLI, and put
a `claude-remote-runner` command on your `PATH`. Nothing is installed
outside `~/.claude-remote` (and, if needed, `~/.local/bin` or your User
`PATH` on Windows) — see the scripts themselves at the repo root.

## First run

```bash
claude-remote-runner
```

The first run asks three questions once, and remembers your answers in
`~/.claude-remote-runner/config.json`:

1. **Server WebSocket URL** — `ws://<host>:4317/ws`, or `wss://...` through
   a tunnel
2. **Folder** this machine's runner is confined to — every command and
   file path Claude Code sends it is resolved relative to this and can't
   escape it
3. **Display name** — how it shows up in the web UI's "Run on" picker

Then it signs you in (username/password — cached afterward at
`~/.claude-remote-runner/session`), connects, and drops you into a `>`
prompt:

```
$ claude-remote-runner
claude-remote — connected as "yashs-laptop"
root: ~/projects
session: A6WMYb1Hzx

Type a task and press Enter. Ctrl+C or "exit" to quit.

> refactor the auth module to use async/await
● Edit: src/auth.js
Done — converted 4 callback chains to async/await.

$0.06 · 12.3s · 2 turns
```

Type a task, press Enter, watch it stream. `exit` or `quit` (or Ctrl+C)
closes it.

To change the server URL, root folder, or display name later:

```bash
claude-remote-runner setup
```

## What's actually happening

Behind that prompt, the runner is doing two things at once:

- Acting as an **executor**: connected to the server as an authenticated
  worker, ready to run whatever `remote_bash` / `remote_read_file` /
  `remote_write_file` / `remote_edit_file` / `remote_list_dir` calls the
  server relays to it.
- Acting as a **chat client**: it finds-or-creates one session targeting
  itself, subscribes to its live event stream over the same WebSocket
  protocol the web UI uses, and renders that stream to your terminal
  instead of a browser.

So when you type a task, the request goes: **your terminal → server →
`claude` process (server's machine, using its login) → MCP tool call →
server → your runner → executed locally → back up the same chain**. See
[Architecture](/guide/architecture) for the full picture.

## Running headless

If stdin isn't a TTY (e.g. under a process manager), the runner skips the
chat prompt and just stays connected as a background executor — sessions
targeting it are then driven entirely from the web UI instead.
