import { createContextMenus } from './utils/contextMenus.js'
import { updateStorage, getStorageData } from './utils/storage.js'
import { checkForUpdates, notifyUserAboutUpdate } from './modules/updateChecker.js'
import { cleanupIsolatedTabs, startIsolation, createIsolatedTab, renameIsolatedTab, removeIsolatedTab, initSessionIsolationListeners, getIsolatedTabsForPopup } from './modules/sessionIsolation.js'

const GITHUB_REPO_URL = 'https://api.github.com/repos/zakyyudha/basuki'
const CURRENT_EXTENSION_VERSION = chrome.runtime.getManifest().version

initSessionIsolationListeners()

console.log('Basuki - version:', CURRENT_EXTENSION_VERSION)

chrome.runtime.onInstalled.addListener((details) => {
  console.log('Basuki - Installed')
  handleInstallation()
  checkAndUpdateIconState()
  checkForUpdates()
  chrome.alarms.create('basuki-update-check', { periodInMinutes: 1440 })
  if (details.reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') })
})

// Also run cleanup on extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Basuki - Started')
  getStorageData('sessionIsolation').then((data) => {
    if (data.sessionIsolation) {
      cleanupIsolatedTabs(data.sessionIsolation)
    }
  })
  checkAndUpdateIconState()
  checkForUpdates()
  chrome.alarms.create('basuki-update-check', { periodInMinutes: 1440 })
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'basuki-update-check') checkForUpdates()
})

// Handles initial setup on installation
function handleInstallation () {
  createContextMenus()

  // Initialize session storage if not exists
  getStorageData('sessionIsolation').then(async (data) => {
    if (!data.sessionIsolation) {
      chrome.storage.local.set({
        sessionIsolation: {
          isolatedTabs: [],
          removedCookies: [],
          lastTabId: null,
        }
      })
    } else {
      // Clean up any invalid isolated tabs on startup
      cleanupIsolatedTabs(data.sessionIsolation)
    }
  })
}


chrome.storage.onChanged.addListener(() => {
  checkAndUpdateIconState()
})

// Updates the extension icon based on storage data
function checkAndUpdateIconState () {
  chrome.storage.local.get((storageData) => {
    const systemEnabled = storageData.systemEnabled !== false
    const isEnabled = systemEnabled && ['apiRedirect', 'apiIntercept'].some(key =>
      storageData[key]?.configs?.some(config => config.enabled),
    )
    // Also check if any isolated tabs are active
    const hasIsolatedTabs = storageData.sessionIsolation?.isolatedTabs?.length > 0
    updateExtensionIcon(isEnabled || hasIsolatedTabs)
  })
}

// Updates extension icon based on the active configuration state
function updateExtensionIcon (isEnabled) {
  const iconPath = isEnabled ? 'images/icon_intercepted.png' : 'images/icon_disabled.png'
  chrome.action.setIcon({
    path: {
      128: chrome.runtime.getURL(iconPath)
    }
  }).catch(err => {
    console.error('Failed to set icon:', err)
  })
}

const TRAFFIC_KEY = 'basukiTraffic'
const MAX_TRAFFIC = 200
const MAX_CAPTURE_BYTES = 64 * 1024
function captureHeaders(headers = {}) {
  return Object.fromEntries(Object.entries(headers).map(([name, value]) => [name, String(value)]))
}

function captureBody(body) {
  if (body == null) return null
  if (typeof body === 'string') return body.slice(0, MAX_CAPTURE_BYTES)
  if (body instanceof ArrayBuffer) return new TextDecoder().decode(body.slice(0, MAX_CAPTURE_BYTES))
  if (Array.isArray(body)) return new TextDecoder().decode(new Uint8Array(body).slice(0, MAX_CAPTURE_BYTES))
  return String(body).slice(0, MAX_CAPTURE_BYTES)
}

function recordTraffic(entry) {
  chrome.storage.local.get([TRAFFIC_KEY], (data) => {
    const current = Array.isArray(data?.[TRAFFIC_KEY]) ? data[TRAFFIC_KEY] : []
    chrome.storage.local.set({
      [TRAFFIC_KEY]: [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...entry }, ...current].slice(0, MAX_TRAFFIC),
    })
  })
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'proxyRequest') {
    let target
    try {
      target = new URL(request.url)
    } catch {
      sendResponse({ ok: false, error: 'Invalid proxy URL' })
      return false
    }

    const isLocalTarget =
      (target.protocol === 'http:' || target.protocol === 'https:') &&
      (target.hostname === 'localhost' || target.hostname === '127.0.0.1' || target.hostname === '::1')

    if (!isLocalTarget) {
      sendResponse({ ok: false, error: 'Proxy target must be localhost' })
      return false
    }

    const startedAt = Date.now()
    fetch(target, {
      method: request.method || 'GET',
      headers: request.headers || {},
      body: request.body,
    }).then(async (response) => {
      const body = await response.arrayBuffer()
      recordTraffic({
        timestamp: startedAt,
        sourceUrl: request.sourceUrl || null,
        method: request.method || 'GET',
        localUrl: target.toString(),
        requestHeaders: captureHeaders(request.headers),
        requestBody: captureBody(request.body),
        status: response.status,
        statusText: response.statusText,
        responseHeaders: captureHeaders(Object.fromEntries(response.headers.entries())),
        responseBody: captureBody(body),
        durationMs: Date.now() - startedAt,
        ok: response.ok,
      })
      sendResponse({
        ok: true,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: Array.from(new Uint8Array(body)),
      })
    }).catch((error) => {
      recordTraffic({
        timestamp: startedAt,
        sourceUrl: request.sourceUrl || null,
        method: request.method || 'GET',
        localUrl: target.toString(),
        requestHeaders: captureHeaders(request.headers),
        requestBody: captureBody(request.body),
        status: null,
        statusText: '',
        responseHeaders: {},
        responseBody: null,
        durationMs: Date.now() - startedAt,
        ok: false,
        error: error.message,
      })
      sendResponse({ ok: false, error: error.message })
    })
    return true
  }

  if (request.action === 'openInspector') {
    chrome.windows.create({ url: chrome.runtime.getURL('inspector.html'), type: 'popup', width: 1100, height: 760 })
    sendResponse({ success: true })
    return false
  }

  if (request.action === 'getIsolatedTabs') {
    Promise.resolve(getIsolatedTabsForPopup())
      .then((isolatedTabs) => {
        sendResponse({ isolatedTabs: Array.isArray(isolatedTabs) ? isolatedTabs : [] })
      })
      .catch((error) => {
        console.error('Basuki - Failed to read isolated tabs for popup:', error)
        sendResponse({ isolatedTabs: [] })
      })
    return true
  }
  
  if (request.action === 'createIsolatedTab') {
    createIsolatedTab(request.url)
    sendResponse({ success: true })
    return true
  }
  
  if (request.action === 'renameIsolatedTab') {
    renameIsolatedTab(request.isolationId, request.newName)
    sendResponse({ success: true })
    return true
  }
  
  if (request.action === 'removeIsolatedTab') {
    removeIsolatedTab(request.isolationId)
    sendResponse({ success: true })
    return true
  }
  
  if (request.action === 'activateIsolatedTab') {
    // Find the tab and activate it
    getStorageData('sessionIsolation').then((data) => {
      if (!data.sessionIsolation) return

      const tabToActivate = data.sessionIsolation.isolatedTabs.find(
        tab => tab.id === request.isolationId
      )

      if (tabToActivate) {
        chrome.tabs.update(tabToActivate.tabId, { active: true })
        chrome.tabs.get(tabToActivate.tabId, (tab) => {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError)
            return
          }

          if (tab.windowId !== chrome.windows.WINDOW_ID_CURRENT) {
            chrome.windows.update(tab.windowId, { focused: true })
          }
        })
        sendResponse({ success: true })
      } else {
        sendResponse({ success: false, error: 'Tab not found' })
      }
    })
    return true
  }

  if (request.action === 'clearAllIsolatedSessions') {
    getStorageData('sessionIsolation').then((data) => {
      if (!data.sessionIsolation) {
        sendResponse({ success: true })
        return
      }

      const sessionIsolation = data.sessionIsolation

      // Close all isolated tabs
      sessionIsolation.isolatedTabs.forEach(tab => {
        chrome.tabs.get(tab.tabId, (existingTab) => {
          if (!chrome.runtime.lastError && existingTab) {
            chrome.tabs.remove(tab.tabId)
          }
        })
      })

      // Restore normal cookies if any were removed
      if (sessionIsolation.removedCookies && sessionIsolation.removedCookies.length > 0) {
        sessionIsolation.removedCookies.forEach(cookie => {
          chrome.cookies.set({
            url: `${cookie.secure ? 'https:' : 'http:'}//${cookie.domain}${cookie.path}`,
            name: cookie.name,
            value: cookie.value,
          })
        })
      }

      // Clear session isolation data
      updateStorage({
        sessionIsolation: {
          isolatedTabs: [],
          removedCookies: [],
          lastTabId: null,
        }
      })

      sendResponse({ success: true })
    })
    return true
  }
})
