const GITHUB_REPO_URL = 'https://api.github.com/repos/zakyyudha/basuki'
const CURRENT_EXTENSION_VERSION = chrome.runtime.getManifest().version

console.log('Basuki - version:', CURRENT_EXTENSION_VERSION)

chrome.runtime.onInstalled.addListener(() => {
  console.log('Basuki - Installed')
  handleInstallation()
  checkAndUpdateIconState()
})

// Handles initial setup on installation
function handleInstallation () {
  if (chrome.runtime.lastError) {
    console.error(chrome.runtime.lastError.message)
    return
  }

  chrome.action.setIcon({ path: 'images/icon_disabled.png' })
  chrome.contextMenus.create({
    id: 'basukiSessionIsolation',
    title: 'Basuki - Isolasi Sesi',
    contexts: ['page'],
  })
  chrome.contextMenus.create({
    id: 'startIsolation',
    title: 'Buka Tab Terisolasi',
    parentId: 'basukiSessionIsolation',
    contexts: ['page'],
  })
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'startIsolation' && tab.url && tab.id) {
    startIsolation(tab.url, tab.id)
  }
})

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
    updateExtensionIcon(isEnabled)
  })
}

// Starts a new isolated session for a tab
function startIsolation (url, tabId) {
  chrome.tabs.create({ url }, (newTab) => {
    if (!newTab) return
    const host = new URL(url).host

    chrome.cookies.getAll({ domain: host }, async (cookies) => {
      const { sessionIsolation = {} } = await chrome.storage.local.get() || {}
      sessionIsolation.isolatedTabs = sessionIsolation.isolatedTabs || []

      sessionIsolation.removedCookies = cookies

      sessionIsolation.isolatedTabs.push({
        host,
        tabId: newTab.id,
        cookies: [],
      })

      removeCookies(cookies)
      updateStorage({ sessionIsolation })
    })
  })
}

// // Listener to handle isolated sessions and cookies for active tabs
chrome.tabs.onActivated.addListener(
  (activeInfo) => handleTabOnActivated(activeInfo.tabId))
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') handleTabOnUpdated(tabId, tab)
})

async function handleTabOnActivated (tabId, tab = null) {
  const { sessionIsolation } = await chrome.storage.local.get() || {}
  const isolatedTab = sessionIsolation?.isolatedTabs?.find(
    t => t.tabId === tabId)

  // need to check is any isolated tab is active or not
  const isIsolatedTabActive = await chrome.tabs.query({ active: true },
    (tabs) => {
      return tabs.some(tab => sessionIsolation?.isolatedTabs?.some(
        isolatedTab => isolatedTab.tabId === tab.id))
    })

  if (isolatedTab) {
    console.log(
      `Tab ${tabId} is activated and isolated. Restoring cookies with isolation...`)
    const host = tab ? new URL(tab.url).host : isolatedTab.host
    chrome.cookies.getAll({ domain: host }, (cookies) => {
      sessionIsolation.removedCookies = cookies
      removeCookies(cookies)
      restoreCookies(isolatedTab.cookies)
      updateStorage({ sessionIsolation })
    })
  } else {
    console.log(
      `Tab ${tabId} is activated and not isolated. Restoring cookies without isolation...`)
    restoreCookies(sessionIsolation?.removedCookies)
    sessionIsolation.removedCookies = []
    updateStorage({ sessionIsolation })
  }
}

async function handleTabOnUpdated (tabId, tab = null) {
  const { sessionIsolation } = await chrome.storage.local.get() || {}
  const isolatedTab = sessionIsolation?.isolatedTabs?.find(
    t => t.tabId === tabId)

  // need to check is tabId is active or not
  const isTabActive = await chrome.tabs.query({ active: true }, (tabs) => {
    console.log('tabs', tabs)
    return tabs.some(tab => tab.id === tabId)
  })

  if (isolatedTab) {
    console.log(
      `Tab ${tabId} updated and isolated. Updating cookies with isolation...`)
    const host = tab ? new URL(tab.url).host : isolatedTab.host
    chrome.cookies.getAll({ domain: host }, (cookies) => {
      isolatedTab.cookies = cookies
      updateStorage({ sessionIsolation })
    })
  }
}

// Removes cookies from the browser
function removeCookies (cookies) {
  cookies.forEach(cookie => {
    chrome.cookies.remove({
      url: `${cookie.secure
        ? 'https:'
        : 'http:'}//${cookie.domain}${cookie.path}`,
      name: cookie.name,
      storeId: cookie.storeId,
    })
  })
}

// Restores cookies in the browser
function restoreCookies (cookies = []) {
  cookies.forEach(cookie => {
    chrome.cookies.set({
      url: `${cookie.secure
        ? 'https:'
        : 'http:'}//${cookie.domain}${cookie.path}`,
      name: cookie.name,
      value: cookie.value,
    })
  })
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  console.log('onRemoved', tabId)
  chrome.storage.local.get(({ sessionIsolation = {} }) => {
    sessionIsolation.isolatedTabs = sessionIsolation.isolatedTabs?.filter(
      tab => tab.tabId !== tabId) || []
    updateStorage({ sessionIsolation }, 'Session isolation for tab destroyed.')
  })
})

// Updates extension icon based on the active configuration state
function updateExtensionIcon (isEnabled) {
  chrome.action.setIcon({
    path: isEnabled
      ? 'images/icon_intercepted.png'
      : 'images/icon_disabled.png',
  })
}

// Checks for updates on GitHub every 30 minutes
async function checkForUpdates () {
  const configs = await chrome.storage.local.get()
  const now = Date.now()
  const thirtyMinutes = 1800000

  if (!configs.lastUpdateCheck || now - configs.lastUpdateCheck >
    thirtyMinutes) {
    try {
      const response = await fetch(`${GITHUB_REPO_URL}/releases/latest`)
      const { tag_name: latestVersion } = await response.json()

      if (latestVersion !== CURRENT_EXTENSION_VERSION) notifyUserAboutUpdate()
      updateStorage({ ...configs, lastUpdateCheck: now })
    } catch (error) {
      console.error('Failed to fetch updates:', error)
    }
  }
}

// Notifies user about an available update
function notifyUserAboutUpdate () {
  const githubRepoPage = 'https://github.com/zakyyudha/basuki'
  chrome.notifications.create(githubRepoPage, {
    type: 'basic',
    iconUrl: 'images/icon_intercepted.png',
    title: 'Basuki - Pembaruan Tersedia',
    message: 'Versi terbaru sudah tersedia. Silakan perbarui ekstensi secara manual.',
  })
  chrome.notifications.onClicked.addListener(
    id => id === githubRepoPage && chrome.tabs.create({ url: githubRepoPage }))
}

// Generalized function to update storage
function updateStorage (data, logMessage = 'Cookies saved to chrome storage') {
  chrome.storage.local.set(data, () => console.log(data, logMessage))
}
