# Decisions log

Non-obvious calls made while building a feature, recorded next to the
docs instead of only in a commit message — so the reasoning is still
findable once the diff isn't the first thing anyone's looking at.

## File uploads (2026-08-13)

**Shipped:** drag-and-drop and clipboard file paste (multi-file) in the
web UI's composer; a `@fileupload` command in the runner CLI's REPL; a
new `POST /api/sessions/:id/uploads` endpoint; `encoding: 'base64'`
support added to the runner's existing `write_file` action.

**Files touched:** `server/src/routes/sessions.js`, `server/package.json`
(added `multer`), `runner/src/actions.js`, `runner/src/attachments.js`
(new), `runner/src/repl.js`, `client/src/lib/api.ts`,
`client/src/components/Composer.tsx`, `client/src/components/ChatView.tsx`.

### Uploads land in `.highwayman-uploads/<sessionId>/`, not the session's own cwd

**Why:** dropping a screenshot into a chat about an unrelated project
would otherwise leave an untracked binary file sitting in that project's
working tree. A dedicated folder keeps uploads out of the way while
staying inside the target's existing boundary (`resolveWorkspacePath` /
`resolveSafe`) — no new "escape the root" surface, just a subfolder
within one that was already enforced.

### A file is referenced by path in the prompt text, not sent as a real multimodal message

**Why:** `claude -p "<prompt>"` takes a plain string — there's no
structured multimodal input at that call site today. Claude's own Read
tool (or `remote_read_file`) already resolves any path mentioned in that
text. So "upload" only ever has to mean: get the bytes onto the target
machine, then make sure their path is in the text for the next turn.
Nothing about turn execution, event parsing, or persistence had to
change.

### The CLI's `@fileupload` never transfers a byte

**Why:** a chat session created from the runner CLI is always targeted at
*itself* (`ensureChatSession` passes its own `runnerId`) — so a path
typed there is already sitting on the exact machine Claude's `remote_*`
tools will read from. Re-uploading it over HTTP would be pure overhead
for zero benefit. `@fileupload` only validates the path stays inside
`root` (reusing `resolveSafe`, the same guard `runner/src/actions.js`
already used) and remembers it to append to the next message.

### The web composer shows `[Uploading name…]` at the cursor, swapped for the resolved path on completion

**Why:** mirrors how a real terminal renders a pasted image as
`[Image #1]` immediately rather than leaving the composer blank while a
network request is in flight. Doing the swap as an exact-string
search-and-replace — with a short random token baked into the
placeholder — sidesteps having to track cursor/selection drift across
several attachments uploading at once; a token already scoped by only the
current turn didn't need to be cryptographically strong.

### `write_file` gained an optional `encoding` param instead of a new action

**Why:** the existing action already had the right shape — path +
content, confined to root via `resolveSafe` — and the only assumption
baked in was UTF-8 text. Making the encoding explicit and opt-in (default
still plain text) means every existing caller, including Claude's own
`remote_write_file` MCP tool, is byte-for-byte unaffected; the upload
route is the only caller that ever passes `encoding: 'base64'`.

### `multer` 2.x, not the 1.x line

**Why:** `npm install` flagged 1.x's known CVEs immediately on adding it
as a dependency. Nothing this feature needs (one in-memory file, a size
cap) depends on 1.x-specific behavior, so there was no reason to take on
a dependency npm itself was warning against.

### 25MB per file, filename reduced to a whitelist, no directory uploads

**Why:** 25MB comfortably covers what a person actually drags into a
chat — screenshots, small documents — without needing to think about
streaming large files through memory (`multer.memoryStorage()` holds the
whole file in RAM). The original filename is never trusted as a path:
only `path.basename()` of it, further restricted to
`[a-zA-Z0-9._-]`, so a crafted filename like `../../etc/passwd` just
becomes `passwd` rather than doing anything with the directory
separators. Directory upload wasn't in scope — the request is only ever
worth building once someone actually asks for it.

## The runner CLI's server URL is cached, but confirmed every run (2026-08-13)

**Shipped:** `--server` flag / `SERVER_URL` env var take priority as
always, one-off and never saved. Absent either, a saved server URL is
shown and a single yes/no prompt — "Connect to a different one this run?"
— decides whether to reuse it (default) or type a new one, which then
becomes the new saved default. First run with nothing saved just asks
directly, looped until non-empty. Folder and display name are unaffected —
asked once, persisted, never re-asked.

**Why:** this superseded an earlier version of this feature that never
cached the server URL at all, on the theory that it's usually an
ngrok-style tunnel URL that changes every restart, so a cached default
would just go stale. In practice that made a *stable* URL (a local
network address, a fixed reverse proxy) annoying to retype on every single
run. A one-question confirmation gets both cases right: a stale tunnel is
one keystroke to override, and a stable address needs nothing entered at
all after the first run.

**Files touched:** `runner/src/config.js`, `runner/src/index.js`,
`runner/.env.example`.

## Assistant text gets its own color, distinct from the prompt (2026-08-13)

**Shipped:** the runner CLI's `◆` assistant-text marker is now cyan and
bold; the `❯` you type your own prompt with stayed magenta but is now also
bold. Previously both used the same accent color, so a fast glance down
the terminal couldn't tell "your line" from "Claude's line" without
reading the glyph itself.

**Why:** the two markers are the only fixed visual anchor at the start of
every line in the transcript — everything after them is plain text. Making
them different hues (rather than, say, only different glyphs) means the
distinction survives even a quick glance or a slightly-too-small font,
where a ❯ and a ◆ can look similar at a distance.

**Files touched:** `runner/src/renderer.js`.

## Renamed to Highwayman; the server runs as a background service; battery status in the CLI (2026-08-22)

**Shipped:** the project renamed `claude-remote` → **Highwayman**. The
runner CLI's binary is now `highwayman` (was `claude-remote`); its state
directory moved from `~/.claude-remote` to `~/.highwayman`; uploads now
land in `.highwayman-uploads/`; the `CLAUDE_REMOTE_*` env vars became
`HIGHWAYMAN_*`. The server gained a `highwayman-server` CLI
(`start`/`stop`/`restart`/`status`/`logs`) so it can run as a background
daemon instead of tying up a foreground terminal. The runner CLI now also
shows the server machine's battery percentage and charging status, in the
connection banner and after every turn.

**Files touched:** `package.json`, `server/package.json`,
`server/src/cli.js` (new), `server/src/battery.js` (new),
`server/src/index.js`, `server/src/mcpBridge.js`,
`server/src/routes/sessions.js`, `runner/package.json`,
`runner/src/index.js`, `runner/src/config.js`, `runner/src/chatSession.js`,
`runner/src/authClient.js`, `runner/src/admin.js`, `runner/src/renderer.js`,
`runner/src/repl.js`, `runner/src/status.js` (new), `runner/.env.example`,
`client/src/lib/api.ts`, `client/src/lib/auth.tsx`,
`client/src/components/LoginScreen.tsx`,
`client/src/components/Sidebar.tsx`, `scripts/dev.js`,
`scripts/serve-public.js`, `install.sh`, `install.ps1`.

### The daemon is a plain detached Node process with a PID file, not a real service manager unit

**Why:** `start`/`stop`/`status` were the actual ask — not systemd/launchd
integration, which would mean per-OS unit files and installation steps for
what's still a one-person dev tool. `highwayman-server` resolves its own
real path via `import.meta.url` (so it works the same whether invoked
through `npm link` or directly from the repo, regardless of the caller's
cwd), spawns `node src/index.js` detached with stdout/stderr redirected to
`~/.highwayman/server.log`, and tracks it by PID in
`~/.highwayman/server.pid`. `stop` just sends `SIGTERM` to that PID. If a
real service manager is ever needed, this CLI is what a unit file would
shell out to anyway.

### Battery status is read directly (`/sys/class/power_supply`, `pmset`, PowerShell), not a new dependency

**Why:** the only thing needed is one percentage and a boolean, on
whichever OS the server happens to run on. A library like
`systeminformation` would pull in far more than that for three
platform-specific reads this project can just do itself in
`server/src/battery.js` — none of which need elevated permissions or
polling infrastructure, since the runner CLI already re-fetches
`GET /api/status` once per turn.

### The GitHub repo, docs deploy path, and install-script URLs stay `claude-remote`

**Why:** the actual git remote (`github.com/nimapdevyash/claude-remote`)
and the GitHub Pages deploy path (`docs/.vitepress/config.mts`'s `base:
'/claude-remote/'`) are external resources this change didn't touch —
renaming those is a separate, deliberate step (a GitHub repo rename plus a
matching `base` update) rather than a side effect of a text rename across
the codebase.

## `highwayman-server` emails its own connection info (2026-08-22)

**Shipped:** `highwayman-server start` optionally opens an ngrok tunnel
(`--public`/`-p`) and, if SMTP is configured, emails an HTML connection-info
card (local/public URL, runner CLI install + connect commands, sign-in
usernames) to `MAIL_TO` or a one-off `--to <emails>` list. A new
`highwayman-server mail <email...>` command sends the same card to any
address on demand, and `connection-info` prints it to the terminal.

**Files touched:** `server/src/cli.js`, `server/src/mailer.js` (new),
`server/src/emailTemplate.js` (new), `server/package.json` (added
`nodemailer`), `server/.env.example`.

### The ngrok tunnel is opt-in (`--public`), not automatic on every `start`

**Why:** `npm run dev` already opens a tunnel unconditionally because
that's a foreground command you're actively watching. `highwayman-server
start` is meant for "leave this running unattended," and silently exposing
a machine to the public internet every time someone backgrounds the server
is the kind of default that surprises people later. Requiring `--public`
makes opening a tunnel a decision, not a side effect.

### Passwords are never emailed — only usernames

**Why:** email isn't a secure channel, and a plaintext password sitting in
an inbox (or a mail server's logs, or a phone's notification preview)
indefinitely is a much bigger liability than typing a password once.
`connection-info` and `status` still print the password, since those stay
on the local machine — the email-vs-console split lives in
`formatConnectionInfo`'s `includePassword` option.

### Recipients: `MAIL_TO` as a default, `--to` (or the `mail` command) for anyone else

**Why:** the common case — notify yourself or a fixed small team whenever
the server comes up — wants zero typing per run, so `MAIL_TO` in
`server/.env` covers it. But "email this one person about this one tunnel"
shouldn't require editing `.env` first, so `--to` on `start`/`restart` and
the standalone `mail <email...>` command both take addresses ad hoc,
requiring only that SMTP itself (`SMTP_USER`/`SMTP_PASS`) is configured —
`MAIL_TO` stays optional.

### HTML with a plain-text fallback, not plain text only

**Why:** the connection info has real structure — a status, two URLs, a
two-step setup, a credentials block — that a wall of monospace text
flattens. `server/src/emailTemplate.js` uses inline `style` attributes
throughout (not a `<style>` block or CSS classes) specifically because
Outlook and other clients strip those; inline styles are what actually
survives across clients. `sendMail` still sends a plain-text version
alongside the HTML for clients that don't render it.
