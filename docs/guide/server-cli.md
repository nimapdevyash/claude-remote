# Server CLI

`npm run dev`/`npm start` are fine for a terminal you're keeping open, but
they don't give you a `stop` from somewhere else. `highwayman-server` is a
thin wrapper around the same `server/src/index.js` that runs it as a
detached background process instead, with a PID file and a log file.

## Install

From the repo:

```bash
cd server
npm link
```

This puts a `highwayman-server` command on your `PATH` (assuming npm's
global bin directory already is, which is typical). It resolves its own
location relative to the actual script file, so it works the same whether
you run it via the linked command or straight out of the repo.

## Commands

```
highwayman-server start             Start the server in the background
highwayman-server stop              Stop it (and its ngrok tunnel, if any)
highwayman-server restart           Stop, then start again
highwayman-server status            Is it running?
highwayman-server logs              Follow the log file (tail -f)
highwayman-server connection-info   Print local/public URLs, connect command, sign-in info
highwayman-server mail <email...>   Email the connection info to any address(es) you list
```

`start`/`restart` options:

```
--public, -p     Also open an ngrok tunnel and include its URL
--to <emails>    Comma-separated recipients for this run's email, instead of MAIL_TO
```

`start` reads `server/.env` the same way `npm start` does (it runs with
`server/` as its working directory), writes its PID to
`~/.highwayman/server.pid`, and appends stdout/stderr to
`~/.highwayman/server.log`. `stop` sends `SIGTERM` to that PID and removes
the PID file. Running `start` again while it's already up is a no-op —
it checks the PID is actually alive first.

## Email notifications

`start` (and `mail`) can email the same connection info `npm run dev`
prints to a console you're not watching, since the server is now running
detached. Configure SMTP once — in `server/.env` (git-ignored) or your own
shell environment, never committed:

```bash
SMTP_HOST=smtp.gmail.com   # default, override for a non-Gmail provider
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password   # Gmail + 2FA needs an App Password, not your real one
MAIL_FROM=you@gmail.com       # optional, defaults to SMTP_USER
MAIL_TO=you@example.com,teammate@example.com   # optional default recipients
```

With `SMTP_USER`/`SMTP_PASS` set, `highwayman-server start` emails
`MAIL_TO` automatically; pass `--to <emails>` to send to different
addresses for just that run instead. `highwayman-server mail <email...>`
sends the current connection info on demand, to any address, regardless of
`MAIL_TO`. If SMTP isn't configured, `start` just prints a warning and
skips the email — nothing else about it changes.

The email is HTML (with a plain-text fallback for clients that don't
render it) and never includes a password — only usernames. Passwords are
still shown by `connection-info` and `status`, since those are local,
not emailed.

## What it doesn't do

This isn't a systemd/launchd unit — it won't survive a reboot or restart
itself on crash. It's the same thing `npm start` does, just detached from
your terminal. If you want it to survive a reboot, point a real service
manager at `highwayman-server start`/`stop` (or at `node src/index.js`
directly) the same way you would for any other Node process.
