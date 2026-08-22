import fs from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const NO_BATTERY = { hasBattery: false, percent: null, charging: null }

function linuxBattery() {
  const base = '/sys/class/power_supply'
  let entries
  try {
    entries = fs.readdirSync(base)
  } catch {
    return NO_BATTERY
  }
  const bat = entries.find((e) => e.startsWith('BAT'))
  if (!bat) return NO_BATTERY
  try {
    const percent = Number(fs.readFileSync(`${base}/${bat}/capacity`, 'utf-8').trim())
    const status = fs.readFileSync(`${base}/${bat}/status`, 'utf-8').trim().toLowerCase()
    return { hasBattery: true, percent, charging: status === 'charging' }
  } catch {
    return NO_BATTERY
  }
}

async function macBattery() {
  try {
    const { stdout } = await execFileAsync('pmset', ['-g', 'batt'])
    const percentMatch = stdout.match(/(\d+)%/)
    if (!percentMatch) return NO_BATTERY
    const charging = /\bcharging\b/i.test(stdout) && !/\bdischarging\b/i.test(stdout)
    return { hasBattery: true, percent: Number(percentMatch[1]), charging }
  } catch {
    return NO_BATTERY
  }
}

async function windowsBattery() {
  try {
    const { stdout } = await execFileAsync('powershell', [
      '-NoProfile',
      '-Command',
      'Get-CimInstance Win32_Battery | Select-Object BatteryStatus,EstimatedChargeRemaining | ConvertTo-Json',
    ])
    const trimmed = stdout.trim()
    if (!trimmed) return NO_BATTERY
    const parsed = JSON.parse(trimmed)
    const info = Array.isArray(parsed) ? parsed[0] : parsed
    if (!info) return NO_BATTERY
    // Win32_Battery BatteryStatus: 6/7/8/9 all mean "charging" in some form.
    const charging = [6, 7, 8, 9].includes(info.BatteryStatus)
    return { hasBattery: true, percent: info.EstimatedChargeRemaining ?? null, charging }
  } catch {
    return NO_BATTERY
  }
}

// Battery status of the machine running the server (not the runner) — the
// runner CLI surfaces this so you know how much runway the login machine
// has left, since it's often a laptop.
export async function getBatteryStatus() {
  if (process.platform === 'linux') return linuxBattery()
  if (process.platform === 'darwin') return macBattery()
  if (process.platform === 'win32') return windowsBattery()
  return NO_BATTERY
}
