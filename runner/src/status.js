// Fetches GET /api/status — currently just the server machine's battery —
// best-effort: any failure (offline, older server without this route) just
// means nothing is shown, never a hard error.
export async function fetchServerBattery(httpBaseUrl, token) {
  try {
    const res = await fetch(`${httpBaseUrl}/api/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const body = await res.json()
    return body.battery || null
  } catch {
    return null
  }
}
