#!/usr/bin/env node
import { accounts } from './accounts.js'
import { prompt, promptHidden } from './prompt.js'

async function main() {
  if (accounts.exists()) {
    console.log(`An account ("${accounts.username()}") already exists.`)
    const answer = await prompt('Replace it with a new username/password? [y/N] ')
    if (!/^y(es)?$/i.test(answer)) {
      console.log('Left the existing account unchanged.')
      process.exit(0)
    }
  }

  console.log('\nSet up your claude-remote account.\n')
  const username = await prompt('Username: ')
  if (!username) {
    console.error('Username is required')
    process.exit(1)
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
  console.log(`\nAccount "${username}" created. Log in with it from the web UI or the runner CLI.`)
  process.exit(0)
}

main()
