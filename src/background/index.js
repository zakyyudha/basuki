import { createContextMenus } from './utils/contextMenus.js'
import { updateStorage, getStorageData } from './utils/storage.js'
import { checkForUpdates, notifyUserAboutUpdate } from './modules/updateChecker.js'
import { cleanupIsolatedTabs, startIsolation, createIsolatedTab, renameIsolatedTab, removeIsolatedTab, initSessionIsolationListeners, getIsolatedTabsForPopup } from './modules/sessionIsolation.js'

const GITHUB_REPO_URL = 'https://api.github.com/repos/zakyyudha/basuki'
const CURRENT_EXTENSION_VERSION = chrome.runtime.getManifest().version

initSessionIsolationListeners()

console.log('Basuki - version:', CURRENT_EXTENSION_VERSION)

chrome.runtime.onInstalled.addListener(() => {
  console.log('Basuki - Installed')
  handleInstallation()
  checkAndUpdateIconState()
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


chrome.storage.onChanged.addListener(async () => {
  checkAndUpdateIconState()
  await checkForUpdates()
})

// Updates the extension icon based on storage data
function checkAndUpdateIconState () {
  chrome.storage.local.get((storageData) => {
    const isEnabled = ['apiRedirect', 'apiIntercept'].some(key =>
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
