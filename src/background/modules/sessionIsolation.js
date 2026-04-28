import { updateStorage, getStorageData } from '../utils/storage.js'

// ============================================================================
// SESSION ISOLATION V5 - Enhanced Cookie Swapping with Bulletproof Locking
// ============================================================================
//
// Why cookie swapping is the only viable approach:
// - Chrome doesn't allow reading Set-Cookie headers (browser security)
// - Chrome doesn't support cookie containers (Firefox feature)
// - declarativeNetRequest can't dynamically inject per-tab cookies
//
// V5 Improvements over V2:
// - Global operation lock (only one cookie operation at a time)
// - Tab loading state tracking (block operations during loads)
// - Debounced tab switches (handle rapid switching)
// - Atomic cookie save/restore (transactional operations)
// - Better error recovery
// ============================================================================

class CookieOperationLock {
  constructor() {
    this.locked = false
    this.queue = []
  }

  async acquire() {
    while (this.locked) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    this.locked = true
  }

  release() {
    this.locked = false
  }

  async withLock(operation) {
    await this.acquire()
    try {
      return await operation()
    } finally {
      this.release()
    }
  }
}

const globalLock = new CookieOperationLock()

// Track tab loading states
const loadingTabs = new Map() // tabId -> { url, startTime, isIsolated }
const switchDebounceTimers = new Map() // tabId -> timerId

// ============================================================================
// CORE COOKIE OPERATIONS - All async/await, no callbacks
// ============================================================================

async function getAllCookies(domain) {
  return new Promise((resolve) => {
    chrome.cookies.getAll({ domain }, (cookies) => {
      console.log(`[Basuki V5] 📋 GET ${cookies?.length || 0} cookies for ${domain}`)
      resolve(cookies || [])
    })
  })
}

async function removeCookie(cookie) {
  return new Promise((resolve) => {
    chrome.cookies.remove({
      url: `${cookie.secure ? 'https:' : 'http:'}//${cookie.domain}${cookie.path}`,
      name: cookie.name,
      storeId: cookie.storeId,
    }, () => resolve())
  })
}

async function setCookie(cookie) {
  return new Promise((resolve) => {
    chrome.cookies.set({
      url: `${cookie.secure ? 'https:' : 'http:'}//${cookie.domain}${cookie.path}`,
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      expirationDate: cookie.expirationDate
    }, () => resolve())
  })
}

async function removeCookies(cookies) {
  if (!cookies || cookies.length === 0) {
    console.log('[Basuki V5] 🗑️ REMOVE 0 cookies (empty)')
    return
  }

  console.log(`[Basuki V5] 🗑️ REMOVE ${cookies.length} cookies:`,
    cookies.map(c => `${c.name} (${c.domain})`))

  await Promise.all(cookies.map(c => removeCookie(c)))
}

async function restoreCookies(cookies) {
  if (!cookies || cookies.length === 0) {
    console.log('[Basuki V5] ✅ RESTORE 0 cookies (empty)')
    return
  }

  console.log(`[Basuki V5] ✅ RESTORE ${cookies.length} cookies:`,
    cookies.map(c => `${c.name} (${c.domain})`))

  await Promise.all(cookies.map(c => setCookie(c)))
}

// ============================================================================
// SESSION STATE MANAGEMENT
// ============================================================================

async function getSessionState() {
  const { sessionIsolation } = await getStorageData('sessionIsolation')
  return sessionIsolation || {
    isolatedTabs: [],
    removedCookies: [],
    lastTabId: null
  }
}

async function saveSessionState(sessionState, message = '') {
  await updateStorage({ sessionIsolation: sessionState }, message)
}

function findIsolatedTab(sessionState, tabId) {
  return sessionState.isolatedTabs?.find(t => t.tabId === tabId)
}

function getActiveIsolatedTab(sessionState) {
  return sessionState.isolatedTabs?.find(t => t.active)
}

// ============================================================================
// TAB LOADING STATE TRACKING
// ============================================================================

function markTabLoading(tabId, url, isIsolated) {
  // Ignore chrome:// and other internal pages - they never finish loading properly
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) {
    console.log(`[Basuki V5] ⏭️ Ignoring internal page: ${url}`)
    return
  }

  loadingTabs.set(tabId, { url, isIsolated, startTime: Date.now() })
  console.log(`[Basuki V5] ⏳ Tab ${tabId} loading: ${url} (isolated: ${isIsolated})`)
}

function markTabLoaded(tabId) {
  if (loadingTabs.has(tabId)) {
    const info = loadingTabs.get(tabId)
    const duration = Date.now() - info.startTime
    console.log(`[Basuki V5] ✅ Tab ${tabId} loaded (${duration}ms)`)
    loadingTabs.delete(tabId)
  }
}

function isAnyTabLoading() {
  return loadingTabs.size > 0
}

function hasLoadingNormalTab() {
  for (const [tabId, info] of loadingTabs.entries()) {
    if (!info.isIsolated) {
      console.log(`[Basuki V5] ⚠️ Normal tab ${tabId} is loading`)
      return true
    }
  }
  return false
}

// ============================================================================
// CORE SESSION ISOLATION FUNCTIONS
// ============================================================================

export async function cleanupIsolatedTabs(sessionIsolation) {
  console.log('[Basuki V5] 🧹 Cleaning up isolated tabs')

  const validTabs = []
  let hasActiveTab = false

  for (const isolatedTab of sessionIsolation.isolatedTabs || []) {
    try {
      const tab = await chrome.tabs.get(isolatedTab.tabId)
      if (tab) {
        if (tab.windowId !== isolatedTab.windowId) {
          isolatedTab.windowId = tab.windowId
        }

        if (isolatedTab.active) {
          if (hasActiveTab) {
            isolatedTab.active = false
          } else {
            hasActiveTab = true
          }
        }

        validTabs.push(isolatedTab)
      }
    } catch (error) {
      console.log(`[Basuki V5] ❌ Removing invalid tab ${isolatedTab.tabId}`)
    }
  }

  if (!hasActiveTab) {
    sessionIsolation.lastTabId = null
  }

  sessionIsolation.isolatedTabs = validTabs
  await updateStorage({ sessionIsolation }, 'Cleaned up isolated tabs')
}

export async function startIsolation(url) {
  return globalLock.withLock(async () => {
    console.log(`[Basuki V5] 🚀 Starting isolation for ${url}`)

    return new Promise((resolve) => {
      chrome.tabs.create({ url }, async (newTab) => {
        if (!newTab) {
          resolve(null)
          return
        }

        const host = new URL(url).host
        const timestamp = Date.now()
        const isolationName = `Isolated: ${host} (${new Date().toLocaleTimeString()})`

        const sessionState = await getSessionState()

        // Deactivate all other isolated tabs
        sessionState.isolatedTabs = (sessionState.isolatedTabs || []).map(tab => ({
          ...tab,
          active: false
        }))

        // Add new isolated tab (don't remove cookies yet - let tab activation handle it)
        sessionState.isolatedTabs.push({
          id: timestamp,
          host,
          tabId: newTab.id,
          windowId: newTab.windowId,
          url: url,
          cookies: [], // Start with empty cookies
          name: isolationName,
          createdAt: timestamp,
          active: false // Not active yet - will be activated by onActivated event
        })

        // Don't remove cookies here! Let handleTabActivated do it when safe
        sessionState.lastTabId = null // Clear last tab since we're creating new

        await saveSessionState(sessionState, 'Created isolated tab (pending activation)')

        console.log(`[Basuki V5] ✅ Isolated tab ${newTab.id} created (will activate when safe)`)
        resolve(newTab)
      })
    })
  })
}

export async function handleTabActivated(tabId) {
  // Debounce rapid tab switches
  if (switchDebounceTimers.has(tabId)) {
    clearTimeout(switchDebounceTimers.get(tabId))
  }

  const timer = setTimeout(async () => {
    switchDebounceTimers.delete(tabId)

    // Block if any tabs are loading
    if (hasLoadingNormalTab()) {
      console.log(`[Basuki V5] 🛑 Blocking tab switch - normal tab loading`)
      return
    }

    await globalLock.withLock(async () => {
      await performTabSwitch(tabId)
    })
  }, 150) // 150ms debounce

  switchDebounceTimers.set(tabId, timer)
}

async function performTabSwitch(tabId) {
  console.log(`[Basuki V5] 🔄 Tab ${tabId} activated`)

  const sessionState = await getSessionState()
  const targetTab = findIsolatedTab(sessionState, tabId)
  const previousActiveTab = getActiveIsolatedTab(sessionState)

  // Check if in current window
  const currentTab = await getCurrentTab()
  if (!currentTab || currentTab.id !== tabId) {
    console.log(`[Basuki V5] ⏭️ Tab ${tabId} not in current window, skipping`)
    return
  }

  // Case 1: Switching TO isolated tab
  if (targetTab) {
    console.log(`[Basuki V5] 🔒 Activating isolated tab ${tabId}`)

    const host = targetTab.host

    // Save previous isolated tab's cookies if exists
    if (previousActiveTab && previousActiveTab.tabId !== tabId) {
      const prevCookies = await getAllCookies(previousActiveTab.host)
      sessionState.isolatedTabs = sessionState.isolatedTabs.map(tab =>
        tab.tabId === previousActiveTab.tabId
          ? { ...tab, cookies: prevCookies, active: false }
          : { ...tab, active: false }
      )
    } else if (!previousActiveTab) {
      // Coming from normal tab - mark all as inactive
      sessionState.isolatedTabs = sessionState.isolatedTabs.map(tab => ({
        ...tab,
        active: false
      }))
    }

    // Get current cookies
    const currentCookies = await getAllCookies(host)

    // Only save to removedCookies if we're NOT coming from another isolated tab
    if (!previousActiveTab && currentCookies.length > 0) {
      console.log(`[Basuki V5] 💾 Saving ${currentCookies.length} normal cookies`)
      sessionState.removedCookies = currentCookies
    } else if (!previousActiveTab) {
      console.log(`[Basuki V5] 📭 No cookies to save (empty)`)
      sessionState.removedCookies = []
    } else {
      console.log(`[Basuki V5] 🔄 Switching between isolated tabs`)
    }

    // Swap cookies
    await removeCookies(currentCookies)
    await restoreCookies(targetTab.cookies)

    // Mark target as active
    sessionState.isolatedTabs = sessionState.isolatedTabs.map(tab => ({
      ...tab,
      active: tab.tabId === tabId
    }))

    sessionState.lastTabId = tabId
    await saveSessionState(sessionState, 'Activated isolated tab')
  }
  // Case 2: Switching FROM isolated TO normal
  else if (previousActiveTab) {
    console.log(`[Basuki V5] 🔓 Deactivating isolation, switching to normal tab ${tabId}`)

    const prevHost = previousActiveTab.host

    // Save isolated tab's current cookies
    const prevCookies = await getAllCookies(prevHost)
    sessionState.isolatedTabs = sessionState.isolatedTabs.map(tab =>
      tab.tabId === previousActiveTab.tabId
        ? { ...tab, cookies: prevCookies, active: false }
        : { ...tab, active: false }
    )

    // Restore normal cookies
    await removeCookies(prevCookies)
    await restoreCookies(sessionState.removedCookies || [])

    sessionState.removedCookies = []
    sessionState.lastTabId = null

    await saveSessionState(sessionState, 'Switched to normal tab')
  }
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

export async function renameIsolatedTab(isolationId, newName) {
  const sessionState = await getSessionState()
  sessionState.isolatedTabs = sessionState.isolatedTabs.map(tab =>
    tab.id === isolationId ? { ...tab, name: newName } : tab
  )
  await saveSessionState(sessionState, 'Renamed isolated tab')
}

export async function createIsolatedTab(url) {
  try {
    new URL(url)
    return await startIsolation(url)
  } catch (e) {
    console.error('[Basuki V5] Invalid URL:', e)
    return null
  }
}

export async function removeIsolatedTab(isolationId) {
  return globalLock.withLock(async () => {
    const sessionState = await getSessionState()
    const tabToRemove = sessionState.isolatedTabs.find(tab => tab.id === isolationId)

    if (!tabToRemove) return

    console.log(`[Basuki V5] 🗑️ Removing isolated tab ${tabToRemove.tabId}`)

    try {
      await chrome.tabs.remove(tabToRemove.tabId)
    } catch (error) {
      console.log(`[Basuki V5] Tab ${tabToRemove.tabId} already closed`)
    }

    sessionState.isolatedTabs = sessionState.isolatedTabs.filter(
      tab => tab.id !== isolationId
    )

    if (tabToRemove.active) {
      await restoreCookies(sessionState.removedCookies || [])
      sessionState.removedCookies = []
      sessionState.lastTabId = null
    }

    await saveSessionState(sessionState, 'Removed isolated tab')
  })
}

export function getIsolatedTabsForPopup() {
  // Synchronous version for popup
  return new Promise(async (resolve) => {
    const sessionState = await getSessionState()
    resolve(sessionState.isolatedTabs || [])
  })
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

export function initSessionIsolationListeners() {
  console.log('[Basuki V5] 🎧 Initializing event listeners')

  chrome.tabs.onActivated.addListener((activeInfo) => {
    handleTabActivated(activeInfo.tabId)
  })

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' && tab?.url) {
      const sessionState = await getSessionState()
      const isIsolated = !!findIsolatedTab(sessionState, tabId)
      markTabLoading(tabId, tab.url, isIsolated)
    }

    if (changeInfo.status === 'complete') {
      markTabLoaded(tabId)

      // Update isolated tab cookies after page load
      const sessionState = await getSessionState()
      const isolatedTab = findIsolatedTab(sessionState, tabId)

      if (isolatedTab && isolatedTab.active && tab?.url) {
        await globalLock.withLock(async () => {
          const host = new URL(tab.url).host
          const cookies = await getAllCookies(host)

          sessionState.isolatedTabs = sessionState.isolatedTabs.map(t =>
            t.tabId === tabId ? { ...t, url: tab.url, cookies } : t
          )

          await saveSessionState(sessionState, 'Updated isolated tab cookies')
        })
      }
    }
  })

  chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) return

    const [activeTab] = await chrome.tabs.query({ active: true, windowId })
    if (activeTab) {
      await handleTabActivated(activeTab.id)
    }
  })

  chrome.tabs.onRemoved.addListener(async (tabId) => {
    console.log('[Basuki V5] 🗑️ Tab removed:', tabId)

    await globalLock.withLock(async () => {
      const sessionState = await getSessionState()
      const removedTab = sessionState.isolatedTabs?.find(tab => tab.tabId === tabId)

      sessionState.isolatedTabs = sessionState.isolatedTabs?.filter(
        tab => tab.tabId !== tabId
      ) || []

      if (removedTab && removedTab.active) {
        await restoreCookies(sessionState.removedCookies || [])
        sessionState.removedCookies = []
        sessionState.lastTabId = null
      }

      await saveSessionState(sessionState, 'Tab removed')
    })

    // Clear loading state
    loadingTabs.delete(tabId)
    if (switchDebounceTimers.has(tabId)) {
      clearTimeout(switchDebounceTimers.get(tabId))
      switchDebounceTimers.delete(tabId)
    }
  })
}
