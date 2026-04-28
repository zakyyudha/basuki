import { bootstrapSnapshot } from '../state/bootstrapSnapshot.js'
import { createRuntimeSync } from '../state/syncRuntime.js'

function normalizeSummary(snapshot) {
  const summary = snapshot?.summary || {}

  return {
    totalRedirects: summary.totalRedirects || (snapshot?.redirects || []).length,
    activeRedirects:
      summary.activeRedirects ||
      (snapshot?.redirects || []).filter((item) => item.enabled).length,
    totalIntercepts: summary.totalIntercepts || (snapshot?.intercepts || []).length,
    activeIntercepts:
      summary.activeIntercepts ||
      (snapshot?.intercepts || []).filter((item) => item.enabled).length,
    totalSessions:
      summary.totalSessions || (snapshot?.sessions || []).length,
    activeSessions:
      summary.activeSessions ||
      (snapshot?.sessions || []).filter((item) => item.active).length,
    storageMode: summary.storageMode || 'chrome.storage.local',
  }
}

export function createPopupStore({ onDebug } = {}) {
  const state = {
    ready: false,
    loading: true,
    redirects: [],
    intercepts: [],
    sessions: [],
    summary: normalizeSummary(null),
    logs: [],
    systemState: 'on',
    hydrationMeta: {
      loadedAt: null,
      errors: [],
    },
  }

  const subscribers = new Set()
  let syncController = null

  function notify() {
    const snapshot = {
      ...state,
      redirects: [...state.redirects],
      intercepts: [...state.intercepts],
      sessions: [...state.sessions],
      logs: [...state.logs],
      summary: { ...state.summary },
      hydrationMeta: {
        loadedAt: state.hydrationMeta.loadedAt,
        errors: [...state.hydrationMeta.errors],
      },
    }

    subscribers.forEach((subscriber) => subscriber(snapshot))
  }

  function applyUpdate(payload = {}) {
    if (Array.isArray(payload.redirects)) {
      state.redirects = payload.redirects
    }

    if (Array.isArray(payload.intercepts)) {
      state.intercepts = payload.intercepts
    }

    if (Array.isArray(payload.sessions)) {
      state.sessions = payload.sessions
    }

    if (Array.isArray(payload.logs)) {
      state.logs = payload.logs
    }

    if (payload.summary) {
      state.summary = {
        ...state.summary,
        ...payload.summary,
      }
    }

    if (payload.systemState) {
      state.systemState = payload.systemState
    }

    if (payload.hydrationMeta) {
      state.hydrationMeta = {
        ...state.hydrationMeta,
        ...payload.hydrationMeta,
      }
    }
  }

  async function initialize() {
    state.loading = true
    notify()

    const bootstrap = await bootstrapSnapshot()

    applyUpdate({
      ...bootstrap.data,
      summary: normalizeSummary(bootstrap.data),
    })

    state.loading = false
    state.ready = true

    if (!bootstrap.ok && bootstrap.error) {
      onDebug?.(bootstrap.error)
    }

    notify()

    syncController = createRuntimeSync({
      onDebug,
      onChange: ({ data }) => {
        applyUpdate({
          ...data,
          summary: normalizeSummary({
            redirects: data?.redirects || state.redirects,
            intercepts: data?.intercepts || state.intercepts,
            sessions: data?.sessions || state.sessions,
            summary: data?.summary || state.summary,
          }),
        })

        notify()
      },
    })

    return getState()
  }

  async function refresh(domains = ['redirect', 'intercept', 'session', 'debug']) {
    if (!syncController) {
      return getState()
    }

    const refreshed = await syncController.triggerRefresh(domains)

    if (refreshed?.data) {
      applyUpdate({
        ...refreshed.data,
        summary: normalizeSummary({
          redirects: refreshed.data.redirects || state.redirects,
          intercepts: refreshed.data.intercepts || state.intercepts,
          sessions: refreshed.data.sessions || state.sessions,
          summary: refreshed.data.summary || state.summary,
        }),
      })
      notify()
    }

    return getState()
  }

  function subscribe(listener) {
    subscribers.add(listener)
    listener(getState())

    return () => {
      subscribers.delete(listener)
    }
  }

  function dispose() {
    syncController?.dispose()
    syncController = null
    subscribers.clear()
  }

  function getState() {
    return {
      ...state,
      redirects: [...state.redirects],
      intercepts: [...state.intercepts],
      sessions: [...state.sessions],
      logs: [...state.logs],
      summary: { ...state.summary },
      hydrationMeta: {
        loadedAt: state.hydrationMeta.loadedAt,
        errors: [...state.hydrationMeta.errors],
      },
    }
  }

  return {
    initialize,
    refresh,
    subscribe,
    dispose,
    getState,
  }
}
