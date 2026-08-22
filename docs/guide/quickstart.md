# Quickstart

Highwayman has three pieces, each its own workspace:

```
claude-remote/
  server/   Express + WebSocket API — spawns `claude`, relays MCP tool calls
  client/   The web UI (Vite + React + Tailwind)
  runner/   The CLI you run on any other machine
  docs/     This site
```

The **server** must run on the machine with your Claude Code login — that's
the one actually doing the reasoning, regardless of which machine a given
session's files/commands end up touching.

## 1. Install and configure the server

```bash
git clone https://github.com/nimapdevyash/claude-remote.git
cd claude-remote
npm install
cp server/.env.example server/.env
```

Create your sign-in account (username + password — see [Auth & security](/guide/security)):

```bash
npm run create-account -w server
```

## 2. Run it

```bash
npm run dev
```

This starts the API server on `http://localhost:4317` and a Vite dev
server on `http://localhost:5173` (proxying `/api` and `/ws` to the
server). Open the client URL and sign in.

For a single-process deployment (what you'd actually tunnel out with
ngrok, for example):

```bash
npm run build   # builds client/dist
npm start       # serves the built client + API from one process on PORT
```

Or run it as a background service instead of tying up a terminal — see
the [Server CLI guide](/guide/server-cli):

```bash
cd server && npm link
highwayman-server start
```

## 3. Create a session

In the web UI, click **New session**, choose **Run on → This server**, and
pick a folder. Type a task — you'll see it stream in as assistant text and
tool-call cards, exactly as `claude` itself would print them, just
rendered in a chat feed instead of a terminal.

## 4. Put a runner on another machine (optional)

If you want Claude Code's actual file edits and shell commands to happen
on a *different* machine, install the runner CLI (`highwayman`) there:

```bash
curl -fsSL https://raw.githubusercontent.com/nimapdevyash/claude-remote/main/install.sh | bash
```

See the [Runner CLI guide](/guide/runner-cli) for the Windows one-liner and
what happens after that.
