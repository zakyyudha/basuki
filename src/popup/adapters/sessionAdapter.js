import { runtimeSendMessage } from './chromeClient.js'

function getFallbackOrigin(session) {
  const candidate = session.origin || session.host || session.url

  if (!candidate) return 'Unknown origin'

  try {
    const parsed = candidate.includes('://')
      ? new URL(candidate)
      : new URL(`https://${candidate}`)
    return parsed.host || candidate
  } catch (error) {
    return String(candidate)
  }
}

function normalizeSession(session, index = 0) {
  const isolationId = session.isolationId ?? session.id ?? session.tabId ?? `session-${index}`
  const fallbackOrigin = getFallbackOrigin(session)
  const url = session.url || (fallbackOrigin === 'Unknown origin' ? '' : `https://${fallbackOrigin}`)

  return {
    ...session,
    id: session.id ?? isolationId,
    isolationId,
    tabId: session.tabId ?? null,
    name: session.name || `Session ${index + 1}`,
    origin: session.origin || fallbackOrigin,
    url,
    active: Boolean(session.active),
    createdAt: session.createdAt || null,
    updatedAt: session.updatedAt || session.createdAt || null,
  }
}

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
      ...result.data,
      isolatedTabs: Array.isArray(result.data?.isolatedTabs)
        ? result.data.isolatedTabs.map(normalizeSession)
        : [],
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
