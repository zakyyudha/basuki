import { storageGet, storageSet } from './chromeClient.js'

const SYSTEM_ENABLED_KEY = 'systemEnabled'

export async function getSystemEnabled() {
  const result = await storageGet(SYSTEM_ENABLED_KEY)
  return result.ok ? result.data?.[SYSTEM_ENABLED_KEY] !== false : true
}

export async function setSystemEnabled(enabled) {
  return storageSet({ [SYSTEM_ENABLED_KEY]: Boolean(enabled) })
}

export async function getUpdateState() {
  const result = await storageGet(['updateAvailable', 'latestVersion'])
  return result.ok ? {
    updateAvailable: result.data?.updateAvailable === true,
    latestVersion: result.data?.latestVersion || null,
  } : { updateAvailable: false, latestVersion: null }
}
