# claude-remote

Run Claude Code from anywhere, two ways:

1. **A web UI** — a chat-style client that streams every event `claude -p
   --output-format stream-json` prints (assistant text, tool calls, tool
   results) live into the browser. Sign in from your phone or another
   laptop and watch a task run in real time.
2. **A runner CLI** — install it on a *different* machine and Claude
   Code's Bash/Read/Write/Edit tools get rerouted over MCP through the
   server to that machine, executed there, confined to a folder you
   choose. Claude keeps reasoning on the machine with your subscription;
   the runner CLI gives you a `>` prompt that makes it feel like it's
   running right there.

**📖 Full documentation: <https://nimapdevyash.github.io/claude-remote/>**

## Install the runner CLI

**macOS / Linux:**

```bash
curl -fsSL https://raw.githubusercontent.com/nimapdevyash/claude-remote/main/install.sh | bash
```

**Windows (PowerShell):**

```powershell
iwr https://raw.githubusercontent.com/nimapdevyash/claude-remote/main/install.ps1 -useb | iex
```

Then run `claude-remote` — first run walks you through server URL,
folder, name, and sign-in.

## Run the server + web UI

```bash
git clone https://github.com/nimapdevyash/claude-remote.git
cd claude-remote
npm install
cp server/.env.example server/.env
npm run create-account -w server   # set your sign-in username/password
npm run dev                         # server on :4317, web UI on :5173
```

To get a public URL instead of localhost (via [ngrok](https://ngrok.com),
already installed and authenticated):

```bash
npm run serve:public
```

This builds the client, starts the server, opens the tunnel, and prints
the public URL — plus the exact `claude-remote --server wss://...` command
to point a runner CLI at it for that run, without overwriting its saved
default. See [Exposing it remotely](https://nimapdevyash.github.io/claude-remote/guide/remote-access)
and [Auth & security](https://nimapdevyash.github.io/claude-remote/guide/security)
before you do.

## Repo layout

```
claude-remote/
  server/   Express + WebSocket API — spawns `claude`, relays MCP tool calls
  client/   The web UI (Vite + React + Tailwind)
  runner/   The CLI you run on any other machine
  docs/     This documentation site (VitePress)
```

## License

MIT
