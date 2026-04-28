import { CONFIG_KIND } from '../utils/constants.js'
import { storageGet, storageSet } from './chromeClient.js'
import { listInterceptConfigs } from './interceptAdapter.js'
import { listRedirectConfigs } from './redirectAdapter.js'
import { getIsolatedTabs } from './sessionAdapter.js'

const logBuffer = []
const MAX_LOGS = 250

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

export async function disableAllRules() {
  const redirectResult = await listRedirectConfigs()
  const interceptResult = await listInterceptConfigs()

  const nextRedirects = (redirectResult.data || []).map((config) => ({
    ...config,
    enabled: false,
  }))

  const nextIntercepts = (interceptResult.data || []).map((config) => ({
    ...config,
    enabled: false,
  }))

  const writeResult = await storageSet({
    [CONFIG_KIND.API_REDIRECT]: { configs: nextRedirects },
    [CONFIG_KIND.API_INTERCEPT]: { configs: nextIntercepts },
  })

  if (!writeResult.ok) {
    const logEntry = pushDebugLog(
      'error',
      'debug',
      'Failed disabling all rules',
      writeResult.error,
    )

    return {
      ok: false,
      data: {
        redirectDisabled: 0,
        interceptDisabled: 0,
        logEntry,
      },
      error: writeResult.error,
    }
  }

  const logEntry = pushDebugLog(
    'warn',
    'debug',
    'All redirect/intercept rules disabled',
    {
      redirectDisabled: nextRedirects.length,
      interceptDisabled: nextIntercepts.length,
    },
  )

  return {
    ok: true,
    data: {
      redirectDisabled: nextRedirects.length,
      interceptDisabled: nextIntercepts.length,
      logEntry,
    },
    error: null,
  }
}

export async function getDebugSummary() {
  const [redirectResult, interceptResult, sessionResult] = await Promise.all([
    listRedirectConfigs(),
    listInterceptConfigs(),
    getIsolatedTabs(),
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
      logs: listDebugLogs(),
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
