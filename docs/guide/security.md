# Auth & security

## Signing in

Sign-in is username/password (not a shared static token) — multiple
accounts are supported, each independently. Create the first one with:

```bash
npm run create-account -w server
```

This hashes the password with `scrypt` (a random salt per account) and
stores every account in `server/data/accounts.json` — that file, along
with the rest of `server/data/`, is git-ignored and never committed.
Running the script again lets you add another account, or update an
existing one's password, without touching the others.

For headless/automated setups, you can instead set `ADMIN_USERNAME` and
`ADMIN_PASSWORD` once in `server/.env`. That one account is synced to
match on **every** boot (not just the first), always flagged as an admin,
and printed to the console on startup — see
[Exposing it remotely](/guide/remote-access) for how `npm run serve:public`
folds this into its own banner too.

Logging in (web UI or runner CLI) exchanges credentials for a **session
token** — a random 32-byte value, valid for 30 days, checked on every REST
call and WebSocket connection. `POST /api/auth/logout` revokes it
immediately.

## Admin accounts

An account with `isAdmin: true` (only the `ADMIN_USERNAME`-bootstrapped
one, by default) can manage other accounts while signed in — no direct
server shell access required:

```bash
claude-remote admin list                     # list accounts
claude-remote admin add <username> [--admin]  # create one, optionally as admin
claude-remote admin remove <username>         # remove one
```

Or from the web UI: a "Manage accounts" entry appears in the sidebar for
admin accounts only. Both are thin clients over `/api/admin/*`, which
`requireAdmin` middleware gates on every request — a non-admin account
gets a 403 whether it goes through the CLI, the UI, or curl directly.
The one guard rail: an admin can't remove the account they're currently
signed in as (avoids an accidental lockout); do that from
`npm run create-account -w server -- --remove <username>` on the server
itself instead.

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

## File uploads

`POST /api/sessions/:id/uploads` sits behind the same `requireAuth` as
every other session route — no separate credential. A few narrower checks
are specific to it:

- Capped at 25MB per file (`multer`'s `limits.fileSize`).
- The original filename is never trusted as a path — only
  `path.basename()` of it, further restricted to a
  `[a-zA-Z0-9._-]` whitelist, so a filename like `../../etc/passwd` just
  becomes `passwd`.
- Where the file actually lands still goes through the exact same
  boundary check as everything else: `resolveWorkspacePath` for a local
  session, `resolveSafe` (via the runner's `write_file` action) for a
  runner-targeted one. Uploads don't introduce a second way to escape a
  session's root — they reuse the one that's already enforced everywhere.

## Exposing it over the internet

If you tunnel the server out (ngrok, Cloudflare Tunnel, Tailscale — see
[Exposing it remotely](/guide/remote-access)), the session-token check is
what's actually protecting it. Treat your account's password the way
you'd treat any other credential that can execute shell commands on your
behalf.
