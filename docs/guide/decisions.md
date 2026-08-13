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

### Uploads land in `.claude-remote-uploads/<sessionId>/`, not the session's own cwd

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

## Server URL is never cached in the runner CLI (2026-08-13)

**Shipped:** `--server` flag / `SERVER_URL` env var / interactive prompt
(looped until non-empty) are the only sources for the server URL on every
run — the value is never read from or written to
`~/.claude-remote/config.json`. Folder and display name are unaffected.

**Why:** the server URL is typically an ngrok-style tunnel that changes on
every restart. Caching it meant the saved default went stale immediately
and silently pointed at a dead tunnel unless `--server` was remembered
every time. Folder and display name describe the machine itself and
genuinely don't change run to run, so those keep the old persisted
behavior.
