const MAX_RUNTIME_LOGS = 200
const RUNTIME_LOGS_KEY = 'basukiLogs'

function injectScript (src, config) {
  // Defensive check for chrome.runtime availability
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.getURL) {
    console.error('Basuki - Chrome runtime API not available!')
    return
  }

  const scriptUrl = chrome.runtime.getURL(src)
  console.log('Basuki - Injecting script from:', scriptUrl)

  const s = document.createElement('script')
  s.src = scriptUrl
  s.type = 'module'   // intercept.js is an ES module — must declare type to allow imports
  s.onerror = (error) => {
    console.error('Basuki - Failed to load intercept script:', error)
    console.error('Basuki - Attempted URL:', scriptUrl)
  }
  s.onload = () => {
    console.log('Basuki - Intercept script loaded successfully')
    s.remove()
    window.postMessage({ type: 'BASUKI_CONFIG', config }, '*')
  };
  (document.head || document.documentElement).append(s)
}

// ── Message bridge: page context → extension context ─────────────────────────
// fetchOverride / xhrOverride post BASUKI_HIT and BASUKI_LOG from page context.
// Content script receives and handles storage writes (has chrome.storage access).
window.addEventListener('message', (event) => {
  if (event.source !== window) return

  // ── BASUKI_HIT: increment hits on a matching redirect/intercept config ──
  if (event.data?.type === 'BASUKI_HIT') {
    const { kind, id } = event.data
    if (!kind || id == null) return

    const storageKey = kind === 'redirect' ? 'apiRedirect' : 'apiIntercept'
    chrome.storage.local.get([storageKey], (data) => {
      if (chrome.runtime.lastError || !data?.[storageKey]?.configs) return
      const configs = data[storageKey].configs.map((c) =>
        // id may be stored as number or string — compare loosely
        // eslint-disable-next-line eqeqeq
        c.id == id ? { ...c, hits: (c.hits || 0) + 1 } : c
      )
      chrome.storage.local.set({ [storageKey]: { ...data[storageKey], configs } })
    })
    return
  }

  // ── BASUKI_LOG: write verbose runtime log to storage ──────────────────────
  if (event.data?.type === 'BASUKI_LOG') {
    const { level = 'info', scope = 'runtime', message = '' } = event.data
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ts: Date.now(),
      level,
      scope,
      message,
    }
    chrome.storage.local.get([RUNTIME_LOGS_KEY], (data) => {
      if (chrome.runtime.lastError) return
      const existing = Array.isArray(data?.[RUNTIME_LOGS_KEY]) ? data[RUNTIME_LOGS_KEY] : []
      // Prepend newest, cap total
      const next = [entry, ...existing].slice(0, MAX_RUNTIME_LOGS)
      chrome.storage.local.set({ [RUNTIME_LOGS_KEY]: next })
    })
    return
  }
})

// ── Boot: read storage, check enabled configs, inject intercept ───────────────
chrome.storage.local.get((data) => {
  // Enhanced debugging
  console.log('Basuki - Storage received:', data)
  console.log('Basuki - Has apiRedirect?', !!data?.apiRedirect)
  console.log('Basuki - Has apiIntercept?', !!data?.apiIntercept)

  // Check if data exists and has at least one configuration type
  if (!data || (!data.apiRedirect && !data.apiIntercept)) {
    console.log('Basuki - No configuration found, skipping injection.')
    console.log('Basuki - Debug: data object is:', JSON.stringify(data))
    return
  }

  const apiRedirectEnabled = data.apiRedirect?.configs?.some(config => config.enabled)
  const apiInterceptEnabled = data.apiIntercept?.configs?.some(config => config.enabled)
  const anyEnabled = apiRedirectEnabled || apiInterceptEnabled

  console.log('Basuki - apiRedirect enabled configs?', apiRedirectEnabled)
  console.log('Basuki - apiIntercept enabled configs?', apiInterceptEnabled)
  console.log('Basuki - Settings Loaded:', data)

  if (!anyEnabled) {
    console.log('Basuki - Disabled because no configs are enabled.')
    return
  }

  console.log('Basuki - ✅ Injecting content script.')
  injectScript('intercept.js', data)
})
