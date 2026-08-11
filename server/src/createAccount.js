#!/usr/bin/env node
import { accounts } from './accounts.js'
import { prompt, promptHidden } from './prompt.js'

async function main() {
  const args = process.argv.slice(2)

  if (args[0] === '--remove' && args[1]) {
    const removed = accounts.remove(args[1])
    console.log(removed ? `Removed account "${args[1]}".` : `No account named "${args[1]}".`)
    process.exit(0)
  }

  const existing = accounts.list()
  if (existing.length > 0) {
    console.log(`Existing accounts: ${existing.join(', ')}\n`)
  }

  const username = await prompt('Username (new, or an existing one to change its password): ')
  if (!username) {
    console.error('Username is required')
    process.exit(1)
  }

  if (accounts.has(username)) {
    const answer = await prompt(`"${username}" already exists — update its password? [y/N] `)
    if (!/^y(es)?$/i.test(answer)) {
      console.log('Left it unchanged.')
      process.exit(0)
    }
  }

  const password = await promptHidden('Password: ')
  if (password.length < 8) {
    console.error('Password must be at least 8 characters')
    process.exit(1)
  }
  const confirm = await promptHidden('Confirm password: ')
  if (password !== confirm) {
    console.error('Passwords did not match')
    process.exit(1)
  }

  accounts.create(username, password)
  console.log(`\nAccount "${username}" saved. Log in with it from the web UI or the runner CLI.`)
  process.exit(0)
}

main()
