import { CONFIG_KIND } from '../utils/constants.js'
import { storageGet, storageSet } from './chromeClient.js'

const EMPTY_DOMAIN = {
  configs: [],
}

function normalizeConfigs(raw) {
  if (!raw || !Array.isArray(raw.configs)) {
    return []
  }

  return raw.configs
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

async function writeDomain(configs) {
  const payload = {
    [CONFIG_KIND.API_INTERCEPT]: { configs },
  }

  const response = await storageSet(payload)
  return toResult(response.ok, payload[CONFIG_KIND.API_INTERCEPT], response.error)
}

export async function listInterceptConfigs() {
  const response = await readDomain()
  return {
    ok: response.ok,
    data: response.data.configs,
    error: response.error,
  }
}

export function createInterceptConfig(payload) {
  return {
    ...payload,
    id: toNumberId(payload?.id),
    enabled: payload?.enabled ?? true,
    debug: payload?.debug ?? false,
  }
}

export async function addInterceptConfig(payload) {
  const current = await readDomain()

  const nextConfigs = [...current.data.configs, createInterceptConfig(payload)]
  const saved = await writeDomain(nextConfigs)

  return {
    ok: saved.ok,
    data: nextConfigs,
    error: current.error || saved.error,
  }
}

export async function updateInterceptConfig(id, updates = {}) {
  const current = await readDomain()
  const targetId = Number(id)

  const nextConfigs = current.data.configs.map((config) =>
    config.id === targetId
      ? {
          ...config,
          ...updates,
          id: config.id,
        }
      : config,
  )

  const saved = await writeDomain(nextConfigs)

  return {
    ok: saved.ok,
    data: nextConfigs,
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

  const nextConfigs = current.data.configs.filter((config) => config.id !== targetId)
  const saved = await writeDomain(nextConfigs)

  return {
    ok: saved.ok,
    data: nextConfigs,
    error: current.error || saved.error,
  }
}
