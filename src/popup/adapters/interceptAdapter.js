import { CONFIG_KIND } from '../constants/config.js'
import { storageGet, storageSet } from './chromeClient.js'

const EMPTY_DOMAIN = {
  configs: [],
}

/**
 * Normalize a stored config (either legacy/runtime or UI format) to UI-friendly shape.
 * Runtime format: { interceptConfigName, interceptRequestMethod, interceptUrlContains,
 *                   interceptHttpStatusCode, interceptResponseBody, enabled, debug }
 * UI format:      { name, method, pattern, status, body, enabled, debug }
 */
function normalizeToUi(config = {}) {
  return {
    ...config,
    id: toNumberId(config.id),
    name: config.name || config.interceptConfigName || '',
    method: (config.method || config.interceptRequestMethod || 'GET').toUpperCase(),
    pattern: config.pattern || config.interceptUrlContains || '',
    status: Number(config.status ?? config.interceptHttpStatusCode ?? 200),
    body: config.body ?? config.interceptResponseBody ?? '',
    enabled: config.enabled ?? true,
    debug: config.debug ?? false,
  }
}

function normalizeConfigs(raw) {
  if (!raw || !Array.isArray(raw.configs)) {
    return []
  }

  return raw.configs.map(normalizeToUi)
}

function toNumberId(id) {
  const numeric = Number(id)
  return Number.isFinite(numeric) ? numeric : Date.now()
}

function toResult(ok, data, error = null) {
  return { ok, data, error }
}

async function readDomain() {
  const response = await storageGet(CONFIG_KIND.API_INTERCEPT)

  if (!response.ok) {
    return toResult(false, { ...EMPTY_DOMAIN }, response.error)
  }

  return toResult(true, {
    configs: normalizeConfigs(response.data?.[CONFIG_KIND.API_INTERCEPT]),
  })
}

/**
 * Convert UI-format config to canonical runtime-compatible storage format.
 * Content runtime reads `interceptUrlContains`, `interceptRequestMethod`,
 * `interceptHttpStatusCode`, and `interceptResponseBody` directly.
 */
export function createInterceptConfig(payload = {}) {
  return {
    id: toNumberId(payload?.id),
    interceptConfigName: (payload?.name || payload?.interceptConfigName || '').trim(),
    interceptRequestMethod: (payload?.method || payload?.interceptRequestMethod || 'GET').toUpperCase(),
    interceptUrlContains: (payload?.pattern || payload?.interceptUrlContains || '').trim(),
    interceptHttpStatusCode: Number(payload?.status ?? payload?.interceptHttpStatusCode ?? 200),
    interceptResponseBody: payload?.body ?? payload?.interceptResponseBody ?? '',
    enabled: payload?.enabled ?? true,
    debug: payload?.debug ?? false,
  }
}

async function writeDomain(uiConfigs) {
  // Convert UI-format arrays to runtime-compatible storage format before persisting.
  const storageConfigs = uiConfigs.map((config) => createInterceptConfig(config))
  const payload = {
    [CONFIG_KIND.API_INTERCEPT]: { configs: storageConfigs },
  }

  const response = await storageSet(payload)
  return toResult(response.ok, storageConfigs.map(normalizeToUi), response.error)
}

export async function listInterceptConfigs() {
  const response = await readDomain()
  return {
    ok: response.ok,
    data: response.data.configs,
    error: response.error,
  }
}

export async function addInterceptConfig(payload) {
  const current = await readDomain()

  const nextUiConfigs = [...current.data.configs, normalizeToUi(createInterceptConfig(payload))]
  const saved = await writeDomain(nextUiConfigs)

  return {
    ok: saved.ok,
    data: saved.data,
    error: current.error || saved.error,
  }
}

export async function updateInterceptConfig(id, updates = {}) {
  const current = await readDomain()
  const targetId = Number(id)

  const nextUiConfigs = current.data.configs.map((config) =>
    config.id === targetId
      ? { ...config, ...updates, id: config.id }
      : config,
  )

  const saved = await writeDomain(nextUiConfigs)

  return {
    ok: saved.ok,
    data: saved.data,
    error: current.error || saved.error,
  }
}

export async function toggleInterceptEnabled(id, enabled) {
  return updateInterceptConfig(id, { enabled: Boolean(enabled) })
}

export async function toggleInterceptDebug(id, debug) {
  return updateInterceptConfig(id, { debug: Boolean(debug) })
}

export async function deleteInterceptConfig(id) {
  const current = await readDomain()
  const targetId = Number(id)

  const nextUiConfigs = current.data.configs.filter((config) => config.id !== targetId)
  const saved = await writeDomain(nextUiConfigs)

  return {
    ok: saved.ok,
    data: saved.data,
    error: current.error || saved.error,
  }
}
