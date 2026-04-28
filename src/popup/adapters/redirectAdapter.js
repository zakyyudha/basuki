import { CONFIG_KIND } from '../constants/config.js'
import { storageGet, storageSet } from './chromeClient.js'

const EMPTY_DOMAIN = {
  configs: [],
}

/**
 * Normalize a stored config (either legacy or new format) to UI-friendly shape.
 * Legacy format: { configName, urlContains, replaceText, withText, enabled, debug, hits }
 * New format:    { name, from, to, enabled, debug, hits }
 * Returns:       { id, name, from, to, enabled, debug, hits }
 */
function normalizeToUi(config) {
  return {
    id: config.id,
    name: config.configName || config.name || '',
    from: config.urlContains || config.from || '',
    to: config.withText || config.to || '',
    enabled: config.enabled ?? true,
    debug: config.debug ?? false,
    hits: config.hits ?? 0,
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
  const response = await storageGet(CONFIG_KIND.API_REDIRECT)

  if (!response.ok) {
    return toResult(false, { ...EMPTY_DOMAIN }, response.error)
  }

  return toResult(true, {
    configs: normalizeConfigs(response.data?.[CONFIG_KIND.API_REDIRECT]),
  })
}

/**
 * Convert UI-format config to canonical storage format.
 * Storage format uses legacy field names so content/utils/configMatcher.js
 * can read `urlContains` and `withText` without modification.
 */
export function createRedirectConfig(payload) {
  const from = (payload?.from || payload?.urlContains || '').trim()
  const to = (payload?.to || payload?.withText || '').trim()
  return {
    id: toNumberId(payload?.id),
    configName: (payload?.name || payload?.configName || '').trim(),
    urlContains: from,
    replaceText: from,
    withText: to,
    enabled: payload?.enabled ?? true,
    debug: payload?.debug ?? false,
    hits: payload?.hits ?? 0,
  }
}

async function writeDomain(uiConfigs) {
  // Convert UI-format arrays to storage-format before persisting
  const storageConfigs = uiConfigs.map((c) => createRedirectConfig(c))
  const payload = {
    [CONFIG_KIND.API_REDIRECT]: { configs: storageConfigs },
  }

  const response = await storageSet(payload)
  // Return UI-format array so callers (AppShell) get normalized data
  return toResult(response.ok, storageConfigs.map(normalizeToUi), response.error)
}

export async function listRedirectConfigs() {
  const response = await readDomain()
  return {
    ok: response.ok,
    data: response.data.configs,
    error: response.error,
  }
}

export async function addRedirectConfig(payload) {
  const current = await readDomain()

  const nextUiConfigs = [...current.data.configs, normalizeToUi(createRedirectConfig(payload))]
  const saved = await writeDomain(nextUiConfigs)

  return {
    ok: saved.ok,
    data: saved.data,
    error: current.error || saved.error,
  }
}

export async function updateRedirectConfig(id, updates = {}) {
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

export async function toggleRedirectEnabled(id, enabled) {
  return updateRedirectConfig(id, { enabled: Boolean(enabled) })
}

export async function toggleRedirectDebug(id, debug) {
  return updateRedirectConfig(id, { debug: Boolean(debug) })
}

export async function deleteRedirectConfig(id) {
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
