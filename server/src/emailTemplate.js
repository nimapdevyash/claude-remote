// Inline-styled (not class/<style>-based) so it renders consistently across
// email clients that strip <style> blocks — Gmail, Outlook, etc. all still
// honor inline `style` attributes.
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace"

function codeBlock(text) {
  return `<div style="background:#0f172a;color:#e2e8f0;font-family:${MONO};font-size:13px;padding:12px 14px;border-radius:8px;white-space:pre-wrap;word-break:break-all;line-height:1.7;">${escapeHtml(text)}</div>`
}

function badge(text, color) {
  return `<span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;background:${color}1a;color:${color};">${escapeHtml(text)}</span>`
}

function sectionLabel(text) {
  return `<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">${escapeHtml(text)}</div>`
}

export function buildConnectionInfoEmail(info, { title = 'Highwayman server is up' } = {}) {
  const connectUrl = info.publicUrl || info.localUrl
  const wsUrl = connectUrl.replace(/^https/, 'wss').replace(/^http/, 'ws')

  const statusBadge = info.serverRunning
    ? badge(`● Running (pid ${info.serverPid})`, '#16a34a')
    : badge('● Not running', '#dc2626')

  let publicRow
  if (info.publicUrl) publicRow = info.publicUrl
  else if (info.ngrokRunning) publicRow = 'tunnel starting…'
  else publicRow = 'none — start with --public to open one'

  const urlRows = [
    ['Local', info.localUrl],
    ['Public', publicRow],
  ]
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:5px 0;color:#64748b;font-size:13px;width:70px;vertical-align:top;">${escapeHtml(label)}</td>
        <td style="padding:5px 0;font-family:${MONO};font-size:13px;color:#0f172a;word-break:break-all;">${escapeHtml(value)}</td>
      </tr>`,
    )
    .join('')

  const noPublicNote = info.publicUrl
    ? ''
    : `<p style="margin:10px 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">No public URL yet — "localhost" above only works from this machine. Restart with <code style="background:#f1f5f9;padding:1px 5px;border-radius:4px;">--public</code> for a real tunnel URL.</p>`

  // Passwords never go in this email — only usernames. Email isn't a secure
  // channel, and a plaintext credential sitting in an inbox indefinitely is
  // a much bigger liability than having to type your password once.
  let credsHtml
  if (info.roles.length > 0) {
    credsHtml =
      `<p style="margin:0;font-size:13px;color:#334155;">${escapeHtml(
        info.roles.map((a) => (a.isAdmin ? `${a.username} (admin)` : a.username)).join(', '),
      )}</p>` + `<p style="margin:8px 0 0;font-size:12px;color:#94a3b8;">Passwords are never emailed — sign in with the one you already have, or run <code style="background:#f1f5f9;padding:1px 5px;border-radius:4px;">npm run create-account -w server</code> to set/reset one.</p>`
  } else {
    credsHtml = `<p style="margin:0;font-size:13px;color:#334155;">No accounts configured yet — run <code style="background:#f1f5f9;padding:1px 5px;border-radius:4px;">npm run create-account -w server</code>.</p>`
  }

  return `
<div style="background:#f1f5f9;padding:32px 16px;font-family:${FONT};">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <div style="background:#111827;padding:26px 28px;">
      <div style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">🏴 Highwayman</div>
      <div style="font-size:13px;color:#9ca3af;margin-top:3px;">${escapeHtml(title)}</div>
    </div>

    <div style="padding:26px 28px;">
      <div style="margin-bottom:22px;">${statusBadge}</div>

      ${sectionLabel('Connect')}
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">${urlRows}</table>
      ${noPublicNote}

      <div style="height:1px;background:#e2e8f0;margin:24px 0;"></div>

      ${sectionLabel('Runner CLI setup')}
      <p style="margin:0 0 6px;font-size:13px;color:#64748b;">1. Install (macOS / Linux)</p>
      ${codeBlock('curl -fsSL https://raw.githubusercontent.com/nimapdevyash/claude-remote/main/install.sh | bash')}
      <p style="margin:16px 0 6px;font-size:13px;color:#64748b;">2. Connect</p>
      ${codeBlock(`highwayman --server ${wsUrl}/ws`)}

      <div style="height:1px;background:#e2e8f0;margin:24px 0;"></div>

      ${sectionLabel('Sign in')}
      ${credsHtml}
    </div>

    <div style="padding:14px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
      <div style="font-size:11px;color:#94a3b8;">Sent automatically by highwayman-server · ${escapeHtml(new Date().toISOString())}</div>
    </div>
  </div>
</div>`
}
