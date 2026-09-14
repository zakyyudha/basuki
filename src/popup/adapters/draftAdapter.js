import { storageGet, storageSet } from './chromeClient.js'

const DRAFTS_KEY = 'basukiEditorDrafts'
const writeQueues = new Map()

function normalizeDrafts(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([, draft]) => (
    draft && typeof draft === 'object' &&
    ['redirect', 'intercept', 'session'].includes(draft.kind) &&
    draft.id != null && draft.values && typeof draft.values === 'object'
  )))
}

export async function listDrafts() {
  const result = await storageGet(DRAFTS_KEY)
  return result.ok ? normalizeDrafts(result.data?.[DRAFTS_KEY]) : {}
}

export async function saveDraft(draft) {
  const key = `${draft.kind}:${draft.id}`
  const previous = writeQueues.get(key) || Promise.resolve()
  const next = previous.catch(() => {}).then(async () => {
    const drafts = await listDrafts()
    drafts[key] = { ...draft, updatedAt: Date.now() }
    return storageSet({ [DRAFTS_KEY]: drafts })
  })
  writeQueues.set(key, next)
  return next.finally(() => {
    if (writeQueues.get(key) === next) writeQueues.delete(key)
  })
}

export async function removeDraft(kind, id) {
  const key = `${kind}:${id}`
  const previous = writeQueues.get(key) || Promise.resolve()
  const next = previous.catch(() => {}).then(async () => {
    const drafts = await listDrafts()
    delete drafts[key]
    return storageSet({ [DRAFTS_KEY]: drafts })
  })
  writeQueues.set(key, next)
  return next.finally(() => {
    if (writeQueues.get(key) === next) writeQueues.delete(key)
  })
}

export function draftKey(kind, id) {
  return `${kind}:${id}`
}
