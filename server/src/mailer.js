import nodemailer from 'nodemailer'

// MAIL_TO is comma/semicolon/whitespace-separated so it can list several
// addresses at once — nodemailer's own `to` field accepts an array fine.
function parseRecipients(value) {
  return (value || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// Only the transport (who's sending) needs to be configured up front —
// recipients can either come from MAIL_TO or be passed in ad hoc per call
// (see `sendMail`'s `to` option / `highwayman-server mail <email...>`).
export function isTransportConfigured() {
  return Boolean(process.env.SMTP_USER?.trim() && process.env.SMTP_PASS)
}

function buildTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env
  return nodemailer.createTransport({
    // Defaults match Gmail SMTP — override for any other provider.
    host: SMTP_HOST?.trim() || 'smtp.gmail.com',
    port: Number(SMTP_PORT) || 465,
    secure: SMTP_SECURE != null ? SMTP_SECURE === 'true' : true,
    auth: { user: SMTP_USER.trim(), pass: SMTP_PASS },
  })
}

// Never throws — a misconfigured or unreachable mail server shouldn't take
// the server (or `highwayman-server start`) down with it. Callers check
// `.sent` and log `.reason`/`.error` themselves. `to` (an explicit array of
// addresses) overrides MAIL_TO for one-off recipients, e.g.
// `highwayman-server mail someone@example.com`.
export async function sendMail({ subject, text, html, to }) {
  if (!isTransportConfigured()) {
    return { sent: false, reason: 'SMTP_USER and SMTP_PASS must be set — in server/.env or your own shell environment' }
  }
  const recipients = to && to.length > 0 ? to : parseRecipients(process.env.MAIL_TO)
  if (recipients.length === 0) {
    return { sent: false, reason: 'No recipients — set MAIL_TO or pass --to <email[,email...]>' }
  }
  try {
    const transport = buildTransport()
    await transport.sendMail({
      from: process.env.MAIL_FROM?.trim() || process.env.SMTP_USER.trim(),
      to: recipients,
      subject,
      text,
      html,
    })
    return { sent: true, to: recipients }
  } catch (err) {
    return { sent: false, reason: err.message }
  }
}
