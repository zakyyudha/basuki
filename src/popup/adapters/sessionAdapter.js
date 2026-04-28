import { runtimeSendMessage } from './chromeClient.js'

function withSafeSessionList(result) {
  if (!result.ok) {
    return {
      ok: false,
      data: { isolatedTabs: [] },
      error: result.error,
    }
  }

  return {
    ok: true,
    data: {
      isolatedTabs: Array.isArray(result.data?.isolatedTabs)
        ? result.data.isolatedTabs
        : [],
      ...result.data,
    },
    error: null,
  }
}

async function sendSessionAction(action, payload = {}) {
  const response = await runtimeSendMessage(action, payload)

  if (!response.ok) {
    return {
      ok: false,
      data: response.data || { success: false },
      error: response.error,
    }
  }

  return {
    ok: true,
    data: response.data || { success: true },
    error: null,
  }
}

export async function getIsolatedTabs() {
  const response = await sendSessionAction('getIsolatedTabs')
  return withSafeSessionList(response)
}

export async function createIsolatedTab(url) {
  return sendSessionAction('createIsolatedTab', { url })
}

export async function activateIsolatedTab(isolationId) {
  return sendSessionAction('activateIsolatedTab', { isolationId })
}

export async function renameIsolatedTab(isolationId, newName) {
  return sendSessionAction('renameIsolatedTab', { isolationId, newName })
}

export async function removeIsolatedTab(isolationId) {
  return sendSessionAction('removeIsolatedTab', { isolationId })
}

export async function clearAllIsolatedSessions() {
  return sendSessionAction('clearAllIsolatedSessions')
}
