export function validateImportSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return { ok: false, error: 'Import snapshot must be a JSON object' }
  }
  if (snapshot.redirect && !Array.isArray(snapshot.redirect.configs)) {
    return { ok: false, error: 'Import redirect.configs must be an array' }
  }
  if (snapshot.intercept && !Array.isArray(snapshot.intercept.configs)) {
    return { ok: false, error: 'Import intercept.configs must be an array' }
  }
  if (snapshot.sessionIsolation && (typeof snapshot.sessionIsolation !== 'object' || Array.isArray(snapshot.sessionIsolation))) {
    return { ok: false, error: 'Import sessionIsolation must be an object' }
  }
  if (!snapshot.redirect && !snapshot.intercept && !snapshot.sessionIsolation) {
    return { ok: false, error: 'Import snapshot contains no supported configuration' }
  }
  return {
    ok: true,
    counts: {
      redirects: snapshot.redirect?.configs?.length || 0,
      intercepts: snapshot.intercept?.configs?.length || 0,
      sessions: snapshot.sessionIsolation?.isolatedTabs?.length || 0,
    },
  }
}
