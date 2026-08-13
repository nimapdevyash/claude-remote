import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'claude-remote',
  description: 'Run Claude Code from anywhere — a web UI and a CLI, both backed by your own machine.',
  base: '/claude-remote/',
  cleanUrls: true,
  lastUpdated: true,

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/quickstart' },
      { text: 'Runner CLI', link: '/guide/runner-cli' },
      { text: 'Architecture', link: '/guide/architecture' },
      { text: 'GitHub', link: 'https://github.com/nimapdevyash/claude-remote' },
    ],

    sidebar: [
      {
        text: 'Getting started',
        items: [
          { text: 'Quickstart', link: '/guide/quickstart' },
          { text: 'Web UI', link: '/guide/web-ui' },
          { text: 'Runner CLI', link: '/guide/runner-cli' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Architecture', link: '/guide/architecture' },
          { text: 'Auth & security', link: '/guide/security' },
          { text: 'Exposing it remotely', link: '/guide/remote-access' },
          { text: 'Decisions log', link: '/guide/decisions' },
        ],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/nimapdevyash/claude-remote' }],

    search: { provider: 'local' },
  },
})
