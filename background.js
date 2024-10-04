const GITHUB_REPO = 'https://api.github.com/repos/zakyyudha/basuki'
const CURRENT_VERSION = chrome.runtime.getManifest().version
console.log('Basuki - API Redirector version:', CURRENT_VERSION)

chrome.runtime.onInstalled.addListener(() => {
  console.log('Basuki - API Redirector installed')
  if (chrome.runtime.lastError) {
    console.error(chrome.runtime.lastError.message)
    return
  }
  chrome.action.setIcon({ path: 'images/icon_disabled.png' })
  chrome.storage.sync.get(['configs'], (data) => {
    const configs = data.configs || []
    if (configs.some(config => config.enabled)) {
      updateIconBasedOnState(true)
    }
  })
})

chrome.storage.onChanged.addListener(async (changes) => {
  console.log('Storage changed', changes)
  if (changes.configs) {
    const newConfigs = changes.configs.newValue || []
    const anyEnabled = newConfigs.some(config => config.enabled)
    updateIconBasedOnState(anyEnabled)
    await checkForUpdates()
  }
})

function updateIconBasedOnState (isEnabled) {
  const iconPath = isEnabled
    ? 'images/icon_intercepted.png'
    : 'images/icon_disabled.png'
  chrome.action.setIcon({ path: iconPath })
}

async function checkForUpdates () {
  const response = await fetch(`${GITHUB_REPO}/releases/latest`)
  const data = await response.json()
  const latestVersion = data.tag_name

  if (latestVersion !== CURRENT_VERSION) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon_intercepted.png',
      title: 'Basuki - Pembaruan Tersedia',
      message: `Versi terbaru sudah tersedia. Silakan perbarui ekstensi secara manual.`,
    })
  }
}
