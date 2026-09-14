import { storageGet, storageSet } from './chromeClient.js'

const PRESETS_KEY = 'basukiSessionPresets'

function normalizePreset(preset, index = 0) {
  return {
    ...preset,
    id: preset.id || `preset-${Date.now()}-${index}`,
    isolationId: null,
    isPreset: true,
    isDraft: false,
    active: false,
    name: preset.name || `Session ${index + 1}`,
    origin: preset.origin || preset.url || '',
    url: preset.url || preset.origin || '',
    userAgent: preset.userAgent || '',
  }
}

export async function listSessionPresets() {
  const result = await storageGet(PRESETS_KEY)
  const presets = Array.isArray(result.data?.[PRESETS_KEY]) ? result.data[PRESETS_KEY] : []
  return result.ok ? presets.map(normalizePreset) : []
}

export async function saveSessionPreset(preset) {
  const presets = await listSessionPresets()
  const next = normalizePreset(preset)
  const index = presets.findIndex(item => item.id === next.id)
  if (index === -1) presets.push(next)
  else presets[index] = { ...presets[index], ...next }
  return storageSet({ [PRESETS_KEY]: presets })
}

export async function removeSessionPreset(id) {
  const presets = await listSessionPresets()
  return storageSet({ [PRESETS_KEY]: presets.filter(item => item.id !== id) })
}
