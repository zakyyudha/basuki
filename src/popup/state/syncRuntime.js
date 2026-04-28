import {
  addStorageChangedListener,
  canUseChromeStorageListener,
} from '../adapters/chromeClient.js'
import { getDebugSummary, pushDebugLog } from '../adapters/debugAdapter.js'
import { listInterceptConfigs } from '../adapters/interceptAdapter.js'
import { listRedirectConfigs } from '../adapters/redirectAdapter.js'
import { getIsolatedTabs } from '../adapters/sessionAdapter.js'

const WATCHED_KEYS = new Set(['apiRedirect', 'apiIntercept', 'sessionIsolation', 'basukiLogs'])

async function refreshByDomain(domain) {
  switch (domain) {
    case 'redirect':
      return listRedirectConfigs()
    case 'intercept':
      return listInterceptConfigs()
    case 'session':
      return getIsolatedTabs()
    case 'debug':
      return getDebugSummary()
    default:
      return {
        ok: false,
        data: null,
        error: {
          code: 'UNKNOWN_DOMAIN',
          message: `Unknown sync domain: ${domain}`,
        },
      }
  }
}

export async function refreshDomains(domains = []) {
  const updates = {}
  const errors = []

  for (const domain of domains) {
    const result = await refreshByDomain(domain)

    if (!result.ok) {
      errors.push(result.error)
      continue
    }

    if (domain === 'session') {
      updates.sessions = result.data?.isolatedTabs || []
      continue
    }

    if (domain === 'debug') {
      updates.summary = result.data || null
      updates.logs = result.data?.logs || []
      continue
    }

    updates[`${domain}s`] = result.data || []
  }

  return {
    ok: errors.length === 0,
    data: updates,
    error: errors[0] || null,
    errors,
  }
}

export function createRuntimeSync({ onChange, onDebug } = {}) {
  if (!canUseChromeStorageListener()) {
    onDebug?.(
      pushDebugLog('warn', 'sync', 'chrome.storage.onChanged unavailable; runtime sync disabled'),
    )

    return {
      dispose: () => {},
      triggerRefresh: async (domains = ['redirect', 'intercept', 'session', 'debug']) => {
        const refreshed = await refreshDomains(domains)
        onChange?.({ source: 'manual-refresh', domains, ...refreshed })
        return refreshed
      },
    }
  }

  const listener = async (changes, namespace) => {
    if (namespace !== 'local') {
      return
    }

    const changedKeys = Object.keys(changes || {})
    const watched = changedKeys.filter((key) => WATCHED_KEYS.has(key))

    if (watched.length === 0) {
      return
    }

    const domains = []
    if (watched.includes('apiRedirect')) domains.push('redirect')
    if (watched.includes('apiIntercept')) domains.push('intercept')
    if (watched.includes('sessionIsolation')) domains.push('session')
    // basukiLogs changes trigger a debug refresh (runtime logs from content script).
    // Rule/session storage changes also affect live summary counters.
    if (watched.includes('basukiLogs') || watched.includes('apiRedirect') || watched.includes('apiIntercept') || watched.includes('sessionIsolation')) domains.push('debug')

    const refreshed = await refreshDomains(domains)
    onChange?.({ source: 'storage.onChanged', watched, domains, ...refreshed })

    if (!refreshed.ok) {
      onDebug?.(
        pushDebugLog('warn', 'sync', 'Runtime sync fallback data applied', {
          watched,
          error: refreshed.error,
        }),
      )
    }
  }

  const registration = addStorageChangedListener(listener)

  if (!registration.ok) {
    onDebug?.(
      pushDebugLog('error', 'sync', 'Failed to register storage listener', registration.error),
    )
  }

  return {
    dispose: () => {
      registration.unsubscribe()
    },
    triggerRefresh: async (domains = ['redirect', 'intercept', 'session', 'debug']) => {
      const refreshed = await refreshDomains(domains)
      onChange?.({ source: 'manual-refresh', domains, ...refreshed })
      return refreshed
    },
  }
}
