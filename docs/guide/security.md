# Auth & security

## Signing in

Sign-in is a single username/password account (not a shared static
token). Create it with:

```bash
npm run create-account -w server
```

This hashes the password with `scrypt` (a random salt per account) and
stores it in `server/data/account.json` — that file, along with the rest
of `server/data/`, is git-ignored and never committed.

For headless/automated setups, you can instead set `ADMIN_USERNAME` and
`ADMIN_PASSWORD` once in `server/.env`; the server hashes and stores them
on first boot, and you can blank the env vars out again afterward.

Logging in (web UI or runner CLI) exchanges those credentials for a
**session token** — a random 32-byte value, valid for 30 days, checked on
every REST call and WebSocket connection. `POST /api/auth/logout`
revokes it immediately. There's no cross-account concept here — it's one
account, by design, for a personal remote-access tool.

## Local sessions

Claude Code runs non-interactively (`-p`/`--print`), so there's no
interactive prompt to approve individual tool calls. `--permission-mode`
(set per session in the UI, or `DEFAULT_PERMISSION_MODE` in `server/.env`)
controls how permissive that is — `acceptEdits` auto-approves file edits
while still consulting your normal Claude Code tool-permission
configuration for everything else; `bypassPermissions` skips all checks
and should only be used for a folder you fully trust.

## Runner-targeted sessions

These pre-approve exactly the five `remote_*` MCP tools via
`--allowedTools`, and disable the local filesystem/Bash tools outright via
`--disallowedTools` — so there's no permission prompt to get stuck on, and
also no way for the session to fall back to touching the server's own
filesystem instead of the runner's. Practically: **connecting a runner is
equivalent to handing out execution access to its configured root folder.**
Point it at something you're comfortable with Claude Code operating on
unattended.

## Internal API

The MCP bridge subprocess (`server/src/mcpBridge.js`) talks to the main
server over HTTP on `127.0.0.1` only, authenticated with a random token
generated fresh each server boot and never sent to the browser or a
runner. Requests from any other address are rejected outright, regardless
of token.

## Exposing it over the internet

If you tunnel the server out (ngrok, Cloudflare Tunnel, Tailscale — see
[Exposing it remotely](/guide/remote-access)), the session-token check is
what's actually protecting it. Treat your account's password the way
you'd treat any other credential that can execute shell commands on your
behalf.
