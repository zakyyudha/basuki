import { getDebugSummary, pushDebugLog } from '../adapters/debugAdapter.js'
import { listInterceptConfigs } from '../adapters/interceptAdapter.js'
import { listRedirectConfigs } from '../adapters/redirectAdapter.js'
import { getIsolatedTabs } from '../adapters/sessionAdapter.js'

function normalizeError(error, fallbackCode = 'BOOTSTRAP_ERROR') {
  if (!error) {
    return null
  }

  return {
    code: error.code || fallbackCode,
    message: error.message || 'Unknown bootstrap error',
    details: error.details || null,
  }
}

function hydrateSystemState(redirects, intercepts) {
  const activeRedirects = redirects.filter((config) => config.enabled).length
  const activeIntercepts = intercepts.filter((config) => config.enabled).length

  if (activeRedirects > 0 || activeIntercepts > 0) {
    return 'intercepting'
  }

  return 'on'
}

export async function bootstrapSnapshot() {
  const [redirectResult, interceptResult, sessionResult, debugResult] = await Promise.all([
    listRedirectConfigs(),
    listInterceptConfigs(),
    getIsolatedTabs(),
    getDebugSummary(),
  ])

  const redirects = redirectResult.data || []
  const intercepts = interceptResult.data || []
  const sessions = sessionResult.data?.isolatedTabs || []
  const summary = debugResult.data || {
    totalRedirects: redirects.length,
    activeRedirects: redirects.filter((config) => config.enabled).length,
    totalIntercepts: intercepts.length,
    activeIntercepts: intercepts.filter((config) => config.enabled).length,
    totalSessions: sessions.length,
    activeSessions: sessions.filter((session) => session.active).length,
    logs: [],
  }

  const errors = [
    normalizeError(redirectResult.error, 'REDIRECT_BOOTSTRAP_FAILED'),
    normalizeError(interceptResult.error, 'INTERCEPT_BOOTSTRAP_FAILED'),
    normalizeError(sessionResult.error, 'SESSION_BOOTSTRAP_FAILED'),
    normalizeError(debugResult.error, 'DEBUG_BOOTSTRAP_FAILED'),
  ].filter(Boolean)

  if (errors.length > 0) {
    pushDebugLog('warn', 'bootstrap', 'Bootstrap snapshot completed with adapter fallback', {
      errors,
    })
  }

  return {
    ok: errors.length === 0,
    data: {
      redirects,
      intercepts,
      sessions,
      summary,
      logs: summary.logs || [],
      systemState: hydrateSystemState(redirects, intercepts),
      hydrationMeta: {
        loadedAt: new Date().toISOString(),
        errors,
      },
    },
    error: errors[0] || null,
  }
}
