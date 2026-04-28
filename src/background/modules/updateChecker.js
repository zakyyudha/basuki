import { updateStorage, getStorageData } from '../utils/storage.js'

const GITHUB_REPO_URL = 'https://api.github.com/repos/zakyyudha/basuki'
const CURRENT_EXTENSION_VERSION = chrome.runtime.getManifest().version

function normalizeVersion(version) {
  return String(version || '')
    .trim()
    .replace(/^v/i, '')
}

function isRemoteVersionNewer(remoteVersion, currentVersion) {
  const remoteParts = normalizeVersion(remoteVersion).split('.').map(Number)
  const currentParts = normalizeVersion(currentVersion).split('.').map(Number)

  for (let index = 0; index < Math.max(remoteParts.length, currentParts.length); index += 1) {
    const remotePart = Number.isFinite(remoteParts[index]) ? remoteParts[index] : 0
    const currentPart = Number.isFinite(currentParts[index]) ? currentParts[index] : 0
    if (remotePart > currentPart) return true
    if (remotePart < currentPart) return false
  }

  return false
}

// Checks for updates on GitHub every 30 minutes
export async function checkForUpdates () {
  const configs = await getStorageData()
  const now = Date.now()
  const thirtyMinutes = 1800000

  if (!configs.lastUpdateCheck || now - configs.lastUpdateCheck > thirtyMinutes) {
    try {
      const response = await fetch(`${GITHUB_REPO_URL}/releases/latest`)
      const { tag_name: latestVersion } = await response.json()

      if (isRemoteVersionNewer(latestVersion, CURRENT_EXTENSION_VERSION)) notifyUserAboutUpdate()
      updateStorage({ ...configs, lastUpdateCheck: now })
    } catch (error) {
      console.error('Failed to fetch updates:', error)
    }
  }
}

// Notifies user about an available update
export function notifyUserAboutUpdate () {
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
