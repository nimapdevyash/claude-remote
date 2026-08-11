# Exposing it remotely

The server only needs one port exposed (`PORT`, default `4317`) once
you've run the production build — that single process serves the web UI,
the REST API, and the WebSocket (both browser clients and runner CLIs
connect to the same port).

```bash
npm run build
npm start
ngrok http 4317
```

Open the `https://*.ngrok-free.app` URL ngrok gives you from your phone or
another laptop and sign in with your account.

A runner CLI can dial out to that same tunnel exactly like a browser does
— just point its `SERVER_URL` at the tunnel's `wss://` address (either via
`claude-remote-runner setup`, or `SERVER_URL` in `runner/.env`).

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
