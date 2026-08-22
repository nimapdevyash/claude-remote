import { promptHidden } from './prompt.js'
import { printTable, printSuccess, printError, dim, green } from './renderer.js'

async function authedFetch(httpBaseUrl, token, urlPath, options = {}) {
  return fetch(`${httpBaseUrl}${urlPath}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })
}

// Admin commands are just thin clients over /api/admin/* — the server
// enforces isAdmin on every one of them, this is not a separate trust
// boundary of its own.
export async function runAdminCommand(httpBaseUrl, token, subcommand, args) {
  if (subcommand === 'list') {
    const res = await authedFetch(httpBaseUrl, token, '/api/admin/accounts')
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      printError(body.error || 'Failed to list accounts')
      process.exit(1)
    }
    console.log()
    printTable(
      ['Username', 'Role'],
      body.map(({ username, isAdmin }) => [username, isAdmin ? green('admin') : dim('member')]),
    )
    process.exit(0)
  }

  if (subcommand === 'add') {
    const username = args.find((a) => !a.startsWith('-'))
    const isAdmin = args.includes('--admin')
    if (!username) {
      printError('Usage: highwayman admin add <username> [--admin]')
      process.exit(1)
    }
    const password = await promptHidden(`Password for "${username}": `)
    if (password.length < 8) {
      printError('Password must be at least 8 characters')
      process.exit(1)
    }
    const res = await authedFetch(httpBaseUrl, token, '/api/admin/accounts', {
      method: 'POST',
      body: JSON.stringify({ username, password, isAdmin }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      printError(body.error || 'Failed to create account')
      process.exit(1)
    }
    printSuccess(`Account "${username}" created${isAdmin ? ' (admin)' : ''}.`)
    process.exit(0)
  }

  if (subcommand === 'remove') {
    const username = args[0]
    if (!username) {
      printError('Usage: highwayman admin remove <username>')
      process.exit(1)
    }
    const res = await authedFetch(httpBaseUrl, token, `/api/admin/accounts/${encodeURIComponent(username)}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      printError(body.error || 'Failed to remove account')
      process.exit(1)
    }
    printSuccess(`Account "${username}" removed.`)
    process.exit(0)
  }

  printError(`Unknown admin subcommand: ${subcommand || '(none)'}`)
  console.log('Usage: highwayman admin <list|add|remove> ...')
  process.exit(1)
}
