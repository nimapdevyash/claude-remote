// Minimal single-mechanism line reader — deliberately avoids Node's
// `readline` module. readline.createInterface() greedily buffers whatever
// arrives on stdin, so creating a fresh interface for each successive
// prompt() call (e.g. username, then password, then confirm) silently
// drops any input the previous interface already buffered.
//
// This instead keeps one persistent stdin listener for the whole process,
// iterates each incoming chunk character-by-character (a single 'data'
// event can carry more than one keystroke — e.g. a paste, or a whole line
// written at once by a non-interactive caller/pty), and queues completed
// lines that arrive before anyone asked for them so a later prompt() call
// can still claim them instead of losing them. The same code path masks
// characters for hidden (password) prompts.

const stdin = process.stdin
const waiters = [] // FIFO of {resolve, mask} for prompt() calls awaiting a line
const completedLines = [] // FIFO of lines read before anyone asked for them
let lineBuffer = ''
let feeding = false

function currentMask() {
  return waiters.length > 0 && waiters[0].mask
}

function startFeed() {
  if (feeding) return
  feeding = true

  if (stdin.isTTY) stdin.setRawMode(true)
  stdin.resume()
  stdin.setEncoding('utf8')

  stdin.on('data', (chunk) => {
    for (const char of chunk) {
      const code = char.charCodeAt(0)

      if (code === 0x03) {
        // Ctrl+C
        process.stdout.write('\n')
        process.exit(1)
      }
      if (char === '\r' || char === '\n') {
        const line = lineBuffer
        lineBuffer = ''
        if (stdin.isTTY) process.stdout.write('\n')
        if (waiters.length > 0) {
          waiters.shift().resolve(line)
        } else {
          completedLines.push(line)
        }
        continue
      }
      if (code === 0x04) {
        // Ctrl+D / EOF
        process.stdout.write('\n')
        process.exit(1)
      }
      if (code === 0x7f || char === '\b') {
        // Backspace/Delete
        if (lineBuffer.length > 0) {
          lineBuffer = lineBuffer.slice(0, -1)
          if (stdin.isTTY) process.stdout.write('\b \b')
        }
        continue
      }
      lineBuffer += char
      if (stdin.isTTY) process.stdout.write(currentMask() ? '*' : char)
    }
  })
}

function readLine(mask) {
  startFeed()
  if (completedLines.length > 0) {
    return Promise.resolve(completedLines.shift())
  }
  return new Promise((resolve) => {
    waiters.push({ resolve, mask })
  })
}

export function prompt(question) {
  process.stdout.write(question)
  return readLine(false).then((v) => v.trim())
}

export function promptHidden(question) {
  process.stdout.write(question)
  return readLine(true)
}
