# Runner CLI

The runner CLI (`highwayman`) is what makes Highwayman feel like Claude
Code is running on whichever machine you're sitting at — even though the
actual model calls happen on the server's machine (the one with your
Claude Code login).

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
a `highwayman` command on your `PATH`. Nothing is installed outside
`~/.highwayman` (and, if needed, `~/.local/bin`, or your User `PATH` on
Windows) — see the scripts themselves at the repo root.

Re-running either one-liner always does a **clean reinstall**: it removes
whatever's at `~/.highwayman/app` first, then fetches a fresh copy.
That's the answer to "how do I update" or "how do I get a clean slate" —
just run the same command again. Your saved config, login session, and
chat history live separately (directly under `~/.highwayman/`, not
`app/`) and survive a reinstall.

## First run

```bash
highwayman
```

The first run asks three questions, and remembers your answers in
`~/.highwayman/config.json`:

1. **Server WebSocket URL** — `ws://<host>:4317/ws`, or `wss://...` through
   a tunnel
2. **Folder** this machine's runner is confined to — every command and
   file path Claude Code sends it is resolved relative to this and can't
   escape it
3. **Display name** — how it shows up in the web UI's "Run on" picker

Every run *after* that just shows the saved server and asks a quick
yes/no — "Connect to a different one this run?" — instead of silently
reusing it or making you retype it. Answer no (or just press Enter) and it
connects to the saved one; answer yes and whatever you type becomes the
new saved default. Folder and display name don't get re-asked at all once
they're saved. Pass `--server`/`-s` or set `SERVER_URL` to skip the
question outright for one run without touching what's saved — the one you
actually want for an ngrok tunnel that gets a new URL every restart.

Then it signs you in (username/password — cached afterward at
`~/.highwayman/session`), connects, and drops you into a prompt:

```
◆ highwayman
  connected as    "yashs-laptop"
  server          ws://localhost:4317/ws
  root            /home/yash/projects
  session         A6WMYb1Hzx
  server battery  🔋 82% (on battery)

────────────────────────────────────────────────
Type a task and press Enter.  Ctrl+C or "exit" to quit.

❯ refactor the auth module to use async/await
● Edit: src/auth.js
Done — converted 4 callback chains to async/await.

$0.06 · 12.3s · 2 turns

server battery: 🔋 81% (on battery)
❯
```

The `server battery` row only appears if the server machine actually has
one (a laptop, say) — desktops just don't show it. It's re-fetched after
every turn, not just once at connect, so it stays current through a long
session.

Type a task, press Enter, watch it stream. `exit` or `quit` (or Ctrl+C)
closes it.

## Commands and flags

```
highwayman                    Connect and open the chat prompt
highwayman setup               Clear saved setup so the next run asks for all three again
highwayman --server <url>      Use this server URL for just this run — never overwrites the saved one
highwayman -s <url>            Shorthand for --server
highwayman --help              Show this

highwayman admin list                     List accounts (admin only)
highwayman admin add <username> [--admin] Create an account (admin only)
highwayman admin remove <username>        Remove an account (admin only)
```

The `admin` commands are thin clients over `/api/admin/*` — the server
enforces admin access on every one of them, so running them signed in as a
non-admin account just gets a 403, same as calling the API directly would.
See [Auth & security](/guide/security) for how accounts and roles work.

`--server`/`-s` is the one to reach for when you're tunneling with ngrok
and get a fresh random URL each time — see
[Exposing it remotely](/guide/remote-access). It takes priority over both
the saved config and the `SERVER_URL` env var, and is never written to
`~/.highwayman/config.json`, so your saved default (e.g. a stable local
address) is untouched for next time.

## Attaching files

```
❯ @fileupload ~/Pictures/screenshot.png notes/bug-report.txt
  attached Pictures/screenshot.png
  attached notes/bug-report.txt
❯ take a look at these and tell me what's going wrong
```

Give `@fileupload` one or more paths — absolute or relative to `root` —
and it checks each one exists and stays inside `root`, then holds onto it.
Whatever you type next gets an "Attached file(s)" block appended listing
every path you attached, and the list clears once that message actually
sends.

Bare `@fileupload` (no paths on the line) drops into a one-path-per-line
prompt instead, so attaching a handful of files doesn't mean one very long
command:

```
❯ @fileupload
  Enter a file path, one per line. Blank line to finish.
  path> ~/Pictures/screenshot.png
  attached Pictures/screenshot.png
  path>
❯
```

Nothing is actually transferred over the network here — the runner CLI
already runs on the exact machine Claude's `remote_*` tools read from, so
a valid path is already exactly where it needs to be. (Compare this to the
web UI's drag-and-drop, which genuinely uploads bytes because the browser
and the target filesystem are different machines — see
[Web UI](/guide/web-ui).)

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
