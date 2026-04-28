/**
 * Shared chrome API client wrappers for popup adapters.
 * Normalizes extension runtime/storage behavior into stable result envelopes.
 */

function createError(code, message, details = null) {
  return {
    code,
    message,
    details,
    at: new Date().toISOString(),
  }
}

function missingChromeApi(apiName) {
  return {
    ok: false,
    data: null,
    error: createError(
      'CHROME_UNAVAILABLE',
      `Chrome API unavailable: ${apiName}`,
      { apiName },
    ),
  }
}

function getStorageArea() {
  return globalThis?.chrome?.storage?.local || null
}

function getRuntime() {
  return globalThis?.chrome?.runtime || null
}

export async function storageGet(keys = null) {
  const storage = getStorageArea()

  if (!storage) {
    return missingChromeApi('storage.local.get')
  }

  try {
    const data = await new Promise((resolve, reject) => {
      storage.get(keys, (result) => {
        const runtimeError = globalThis?.chrome?.runtime?.lastError
        if (runtimeError) {
          reject(runtimeError)
          return
        }
        resolve(result || {})
      })
    })

    return {
      ok: true,
      data,
      error: null,
    }
  } catch (error) {
    return {
      ok: false,
      data: {},
      error: createError(
        'STORAGE_READ_FAILED',
        error?.message || 'Failed to read chrome.storage.local',
        { keys },
      ),
    }
  }
}

export async function storageSet(payload) {
  const storage = getStorageArea()

  if (!storage) {
    return missingChromeApi('storage.local.set')
  }

  try {
    await new Promise((resolve, reject) => {
      storage.set(payload, () => {
        const runtimeError = globalThis?.chrome?.runtime?.lastError
        if (runtimeError) {
          reject(runtimeError)
          return
        }
        resolve()
      })
    })

    return {
      ok: true,
      data: payload,
      error: null,
    }
  } catch (error) {
    return {
      ok: false,
      data: payload,
      error: createError(
        'STORAGE_WRITE_FAILED',
        error?.message || 'Failed to write chrome.storage.local',
        { keys: Object.keys(payload || {}) },
      ),
    }
  }
}

export async function runtimeSendMessage(action, payload = {}) {
  const runtime = getRuntime()

  if (!runtime) {
    return missingChromeApi('runtime.sendMessage')
  }

  try {
    const data = await new Promise((resolve, reject) => {
      runtime.sendMessage({ action, ...payload }, (response) => {
        const runtimeError = globalThis?.chrome?.runtime?.lastError
        if (runtimeError) {
          reject(runtimeError)
          return
        }

        resolve(response)
      })
    })

    return {
      ok: true,
      data,
      error: null,
    }
  } catch (error) {
    return {
      ok: false,
      data: { success: false, error: error?.message || 'runtime.sendMessage failed' },
      error: createError(
        'RUNTIME_MESSAGE_FAILED',
        error?.message || 'Failed to send runtime message',
        { action, payload },
      ),
    }
  }
}

export function canUseChromeStorageListener() {
  return Boolean(globalThis?.chrome?.storage?.onChanged?.addListener)
}

export function addStorageChangedListener(listener) {
  const storageChanged = globalThis?.chrome?.storage?.onChanged

  if (!storageChanged?.addListener || !storageChanged?.removeListener) {
    return {
      ok: false,
      error: createError(
        'CHROME_UNAVAILABLE',
        'chrome.storage.onChanged is unavailable',
      ),
      unsubscribe: () => {},
    }
  }

  storageChanged.addListener(listener)

  return {
    ok: true,
    error: null,
    unsubscribe: () => {
      storageChanged.removeListener(listener)
    },
  }
}
