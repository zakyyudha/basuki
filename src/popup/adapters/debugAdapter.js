import { CONFIG_KIND } from '../constants/config.js'
import { storageGet, storageSet } from './chromeClient.js'
import { listInterceptConfigs, toggleInterceptEnabled } from './interceptAdapter.js'
import { listRedirectConfigs, toggleRedirectEnabled } from './redirectAdapter.js'
import { getIsolatedTabs } from './sessionAdapter.js'

const logBuffer = []
const MAX_LOGS = 250
const RUNTIME_LOGS_KEY = 'basukiLogs'

function nowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function buildLog(level, scope, message, metadata = null) {
  return {
    id: nowId(),
    ts: Date.now(),
    level,
    scope,
    message,
    metadata,
  }
}

export function pushDebugLog(level, scope, message, metadata = null) {
  const entry = buildLog(level, scope, message, metadata)
  logBuffer.unshift(entry)
  if (logBuffer.length > MAX_LOGS) {
    logBuffer.splice(MAX_LOGS)
  }
  return entry
}

export function listDebugLogs() {
  return [...logBuffer]
}

export function clearDebugLogs() {
  logBuffer.length = 0
  return []
}

/**
 * Load verbose runtime logs from chrome.storage.local (written by content script bridge).
 * These capture actual redirect/intercept events on real pages.
 */
export async function loadRuntimeLogs() {
  const response = await storageGet(RUNTIME_LOGS_KEY)
  if (!response.ok || !Array.isArray(response.data?.[RUNTIME_LOGS_KEY])) {
    return []
  }
  return response.data[RUNTIME_LOGS_KEY]
}

export async function clearRuntimeLogs() {
  await storageSet({ [RUNTIME_LOGS_KEY]: [] })
  return []
}

/**
 * Merge popup in-memory logs + storage runtime logs, sorted newest-first.
 */
export async function listAllLogs() {
  const runtimeLogs = await loadRuntimeLogs()
  const popupLogs = listDebugLogs()
  const merged = [...popupLogs, ...runtimeLogs].sort((a, b) => (b.ts || 0) - (a.ts || 0))
  return merged.slice(0, MAX_LOGS)
}

export async function disableAllRules() {
  const redirectResult = await listRedirectConfigs()
  const interceptResult = await listInterceptConfigs()

  const redirects = redirectResult.data || []
  const intercepts = interceptResult.data || []
  const activeRedirects = redirects.filter((config) => config.enabled)
  const activeIntercepts = intercepts.filter((config) => config.enabled)

  for (const config of activeRedirects) {
    const result = await toggleRedirectEnabled(config.id, false)
    if (!result.ok) {
      const logEntry = pushDebugLog('error', 'debug', 'Failed disabling redirect rule', result.error)
      return {
        ok: false,
        data: { redirectDisabled: 0, interceptDisabled: 0, logEntry },
        error: result.error,
      }
    }
  }

  for (const config of activeIntercepts) {
    const result = await toggleInterceptEnabled(config.id, false)
    if (!result.ok) {
      const logEntry = pushDebugLog('error', 'debug', 'Failed disabling intercept rule', result.error)
      return {
        ok: false,
        data: { redirectDisabled: activeRedirects.length, interceptDisabled: 0, logEntry },
        error: result.error,
      }
    }
  }

  const logEntry = pushDebugLog(
    'warn',
    'debug',
    'All redirect/intercept rules disabled',
    {
      redirectDisabled: activeRedirects.length,
      interceptDisabled: activeIntercepts.length,
    },
  )

  return {
    ok: true,
    data: {
      redirectDisabled: activeRedirects.length,
      interceptDisabled: activeIntercepts.length,
      logEntry,
    },
    error: null,
  }
}

export async function getDebugSummary() {
  const [redirectResult, interceptResult, sessionResult, allLogs] = await Promise.all([
    listRedirectConfigs(),
    listInterceptConfigs(),
    getIsolatedTabs(),
    listAllLogs(),
  ])

  const redirects = redirectResult.data || []
  const intercepts = interceptResult.data || []
  const sessions = sessionResult.data?.isolatedTabs || []

  return {
    ok: redirectResult.ok && interceptResult.ok && sessionResult.ok,
    data: {
      totalRedirects: redirects.length,
      activeRedirects: redirects.filter((config) => config.enabled).length,
      totalIntercepts: intercepts.length,
      activeIntercepts: intercepts.filter((config) => config.enabled).length,
      totalSessions: sessions.length,
      activeSessions: sessions.filter((session) => session.active).length,
      storageMode: 'chrome.storage.local',
      logs: allLogs,
    },
    error: redirectResult.error || interceptResult.error || sessionResult.error,
  }
}

export async function exportConfigSnapshot() {
  const response = await storageGet([
    CONFIG_KIND.API_REDIRECT,
    CONFIG_KIND.API_INTERCEPT,
    'sessionIsolation',
  ])

  if (!response.ok) {
    return {
      ok: false,
      data: {
        version: '2.0.0',
        exportedAt: new Date().toISOString(),
        redirect: { configs: [] },
        intercept: { configs: [] },
        sessionIsolation: { isolatedTabs: [] },
      },
      error: response.error,
    }
  }

  return {
    ok: true,
    data: {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      redirect: response.data?.[CONFIG_KIND.API_REDIRECT] || { configs: [] },
      intercept: response.data?.[CONFIG_KIND.API_INTERCEPT] || { configs: [] },
      sessionIsolation: response.data?.sessionIsolation || { isolatedTabs: [] },
    },
    error: null,
  }
}

function getImportValidationError(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return 'Import snapshot must be a JSON object'
  }
  if (snapshot.redirect && !Array.isArray(snapshot.redirect.configs)) {
    return 'Import redirect.configs must be an array'
  }
  if (snapshot.intercept && !Array.isArray(snapshot.intercept.configs)) {
    return 'Import intercept.configs must be an array'
  }
  if (snapshot.sessionIsolation && (typeof snapshot.sessionIsolation !== 'object' || Array.isArray(snapshot.sessionIsolation))) {
    return 'Import sessionIsolation must be an object'
  }
  return null
}

export async function importConfigSnapshot(snapshot) {
  const validationError = getImportValidationError(snapshot)
  if (validationError) {
    const logEntry = pushDebugLog('error', 'debug', validationError)
    return {
      ok: false,
      data: { logEntry },
      error: { code: 'INVALID_IMPORT', message: validationError },
    }
  }

  const nextStorage = {}
  if (snapshot.redirect) {
    nextStorage[CONFIG_KIND.API_REDIRECT] = { configs: snapshot.redirect.configs }
  }
  if (snapshot.intercept) {
    nextStorage[CONFIG_KIND.API_INTERCEPT] = { configs: snapshot.intercept.configs }
  }
  if (snapshot.sessionIsolation) {
    nextStorage.sessionIsolation = snapshot.sessionIsolation
  }

  const writeResult = await storageSet(nextStorage)
  if (!writeResult.ok) {
    const logEntry = pushDebugLog('error', 'debug', 'Failed importing config snapshot', writeResult.error)
    return {
      ok: false,
      data: { logEntry },
      error: writeResult.error,
    }
  }

  const logEntry = pushDebugLog('info', 'debug', 'Imported config snapshot', {
    redirect: Boolean(snapshot.redirect),
    intercept: Boolean(snapshot.intercept),
    sessionIsolation: Boolean(snapshot.sessionIsolation),
  })

  return {
    ok: true,
    data: { logEntry, imported: Object.keys(nextStorage) },
    error: null,
  }
}

export async function buildCopySummary() {
  const summaryResult = await getDebugSummary()
  const snapshotResult = await exportConfigSnapshot()

  if (!summaryResult.ok || !snapshotResult.ok) {
    return {
      ok: false,
      data: 'Failed to build debug summary',
      error: summaryResult.error || snapshotResult.error,
    }
  }

  const summary = summaryResult.data
  const snapshot = snapshotResult.data

  const text = [
    '[Basuki Debug Summary]',
    `Exported: ${snapshot.exportedAt}`,
    `Redirects: ${summary.activeRedirects}/${summary.totalRedirects} enabled`,
    `Intercepts: ${summary.activeIntercepts}/${summary.totalIntercepts} enabled`,
    `Sessions: ${summary.activeSessions}/${summary.totalSessions} active`,
    `Log entries: ${summary.logs.length}`,
    `Storage: ${summary.storageMode}`,
  ].join('\n')

  return {
    ok: true,
    data: text,
    error: null,
  }
}
