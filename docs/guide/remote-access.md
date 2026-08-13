# Exposing it remotely

## One command

```bash
npm run serve:public
```

This builds the client, starts the production server, opens an ngrok
tunnel to it, and prints the public URL — no localhost address, no manual
`ngrok http` in a separate terminal. Requires the `ngrok` CLI already
installed and authenticated (`ngrok config add-authtoken <token>`, from
your ngrok dashboard). Ctrl+C stops both the server and the tunnel
together.

It prints something like:

```
================================================================
  claude-remote is live at: https://abc123.ngrok-free.app
  (local: http://localhost:4317)

  Point the runner CLI at this tunnel for just this run:
    claude-remote --server wss://abc123.ngrok-free.app/ws
================================================================
```

Open that `https://` URL from your phone or another laptop and sign in
with your account.

## Pointing the runner CLI at a tunnel

The server URL is never saved between runs in the first place — ngrok's
free tier gives you a new random URL every time you restart it, so caching
one would just mean silently pointing at a dead tunnel. Every run either
prompts for it fresh or takes an override:

```bash
claude-remote --server wss://abc123.ngrok-free.app/ws
# or the short form:
claude-remote -s wss://abc123.ngrok-free.app/ws
```

`--server`/`-s` takes priority over the `SERVER_URL` env var, which takes
priority over the interactive prompt. None of the three is ever written to
`~/.claude-remote/config.json` — only the folder and display name are.

## Notes

- ngrok's free-tier URLs are randomly generated but publicly reachable by
  anyone who has the link — your account's password is what actually
  protects it, not the URL's obscurity.
- For anything longer-lived than a quick session, prefer a tunnel with its
  own auth layered on top (ngrok's access control, a Cloudflare Tunnel, or
  a Tailscale network) in addition to signing in.
- Multiple devices can open the same session at once — they all subscribe
  to the same WebSocket room and see the identical live stream, so you can
  genuinely watch a task run from your phone and your laptop
  simultaneously.
