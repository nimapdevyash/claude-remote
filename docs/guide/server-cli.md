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
highwayman-server start     Start the server in the background
highwayman-server stop      Stop it
highwayman-server restart   Stop, then start again
highwayman-server status    Is it running?
highwayman-server logs      Follow the log file (tail -f)
```

`start` reads `server/.env` the same way `npm start` does (it runs with
`server/` as its working directory), writes its PID to
`~/.highwayman/server.pid`, and appends stdout/stderr to
`~/.highwayman/server.log`. `stop` sends `SIGTERM` to that PID and removes
the PID file. Running `start` again while it's already up is a no-op —
it checks the PID is actually alive first.

## What it doesn't do

This isn't a systemd/launchd unit — it won't survive a reboot or restart
itself on crash. It's the same thing `npm start` does, just detached from
your terminal. If you want it to survive a reboot, point a real service
manager at `highwayman-server start`/`stop` (or at `node src/index.js`
directly) the same way you would for any other Node process.
