export function normalizeHttpUrl(value, defaultProtocol = 'https:') {
  const raw = String(value || '').trim()
  if (!raw) return { ok: false, error: 'required', value: '' }
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `${defaultProtocol}//${raw}`
  try {
    const url = new URL(candidate)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
      return { ok: false, error: 'protocol', value: '' }
    }
    return { ok: true, value: url.toString() }
  } catch {
    return { ok: false, error: 'url', value: '' }
  }
}

export function validateRedirectDestination(value) {
  return normalizeHttpUrl(value, 'http:')
}

export function validateSessionOrigin(value) {
  return normalizeHttpUrl(value, 'https:')
}

export function looksLikeJson(value) {
  return /^[\s]*[\[{]/.test(String(value || ''))
}

export function isValidJson(value) {
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}
