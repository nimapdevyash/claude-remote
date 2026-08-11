---
layout: home

hero:
  name: claude-remote
  text: Run Claude Code from anywhere
  tagline: A web UI and a CLI, both backed by the machine that holds your Claude Code login — reach it from your phone, or hand its hands to a different laptop entirely.
  actions:
    - theme: brand
      text: Quickstart
      link: /guide/quickstart
    - theme: alt
      text: Install the runner CLI
      link: /guide/runner-cli
    - theme: alt
      text: View on GitHub
      link: https://github.com/nimapdevyash/claude-remote

features:
  - title: Chat-style web UI
    details: Spawns `claude -p --output-format stream-json` and streams every event — assistant text, tool calls, tool results — into a live browser chat feed. Multiple devices can watch the same session at once.
  - title: Interactive runner CLI
    details: Install with one command on any machine. It signs in, then gives you a `>` prompt that feels exactly like running `claude` locally — except the reasoning happens on your main machine's login, and effects land on this one.
  - title: Real remote execution, not a demo
    details: Bash/Read/Write/Edit are rerouted over MCP through the server to the connected runner, confined to a folder you choose. Nothing executes anywhere you didn't point it at.
---
