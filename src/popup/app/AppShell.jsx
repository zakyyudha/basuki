import React, { useState, useCallback, useEffect, useRef } from 'react'
import { t } from '../i18n/dictionary.js'
import { getStoredLanguage, setStoredLanguage } from '../i18n/languageStore.js'
import { RedirectEditor, InterceptEditor, SessionEditor, ConfirmDialog } from './editors.jsx'
import {
  listRedirectConfigs, addRedirectConfig, updateRedirectConfig,
  deleteRedirectConfig, toggleRedirectEnabled,
} from '../adapters/redirectAdapter.js'
import {
  listInterceptConfigs, addInterceptConfig, updateInterceptConfig,
  deleteInterceptConfig, toggleInterceptEnabled,
} from '../adapters/interceptAdapter.js'
import {
  pushDebugLog,
  listDebugLogs,
  clearDebugLogs,
  listAllLogs,
  clearRuntimeLogs,
  exportConfigSnapshot,
  importConfigSnapshot,
  buildCopySummary,
} from '../adapters/debugAdapter.js'
import {
  activateIsolatedTab,
  createIsolatedTab,
  getIsolatedTabs,
  removeIsolatedTab,
  renameIsolatedTab,
} from '../adapters/sessionAdapter.js'

const LANGS = [{ key: 'en', label: 'EN' }, { key: 'id', label: 'ID' }]
const TABS = [
  { key: 'redirect', tKey: 'tab_redirect' },
  { key: 'intercept', tKey: 'tab_intercept' },
  { key: 'session', tKey: 'tab_session' },
  { key: 'debug', tKey: 'tab_debug' },
]
const SYSTEM_ON_STORAGE_KEY = 'basuki:popup:systemOn'
const PAUSED_RULES_STORAGE_KEY = 'basuki:popup:pausedRules'
const MANIFEST_VERSION = chrome.runtime.getManifest().version

function getStoredSystemOn() {
  try {
    const stored = localStorage.getItem(SYSTEM_ON_STORAGE_KEY)
    return stored === null ? true : stored !== 'false'
  } catch (error) {
    console.warn('[popup] Failed to read system state preference', error)
    return true
  }
}

function setStoredSystemOn(value) {
  try {
    localStorage.setItem(SYSTEM_ON_STORAGE_KEY, value ? 'true' : 'false')
  } catch (error) {
    console.warn('[popup] Failed to store system state preference', error)
  }
}

function getStoredPausedRules() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PAUSED_RULES_STORAGE_KEY) || '{}')
    return {
      redirects: Array.isArray(parsed.redirects) ? parsed.redirects : [],
      intercepts: Array.isArray(parsed.intercepts) ? parsed.intercepts : [],
    }
  } catch (error) {
    console.warn('[popup] Failed to read paused rules snapshot', error)
    return { redirects: [], intercepts: [] }
  }
}

function setStoredPausedRules(snapshot) {
  try {
    localStorage.setItem(PAUSED_RULES_STORAGE_KEY, JSON.stringify({
      redirects: Array.isArray(snapshot.redirects) ? snapshot.redirects : [],
      intercepts: Array.isArray(snapshot.intercepts) ? snapshot.intercepts : [],
    }))
  } catch (error) {
    console.warn('[popup] Failed to store paused rules snapshot', error)
  }
}

function clearStoredPausedRules() {
  try {
    localStorage.removeItem(PAUSED_RULES_STORAGE_KEY)
  } catch (error) {
    console.warn('[popup] Failed to clear paused rules snapshot', error)
  }
}

/* ── Toggle ───────────────────────────────────────────────────────────────── */
function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label}
      onClick={e => { e.stopPropagation(); onChange(!checked) }}
      className={`toggle${checked ? ' on' : ''}`}>
      <span className="toggle__dot" />
    </button>
  )
}

/* ── Basuki icon (real PNG from rework assets) ────────────────────────────── */
function BasukiIcon({ state }) {
  const src = state === 'off'
    ? './assets/icon_disabled.png'
    : state === 'intercepting'
      ? './assets/icon_intercepted.png'
      : './assets/icon_enabled.png'
  return (
    <img src={src} alt={`Basuki ${state}`}
      style={{ width: 32, height: 32, objectFit: 'contain', imageRendering: 'crisp-edges' }} />
  )
}

/* ── Method badge ─────────────────────────────────────────────────────────── */
const METHOD_COLORS = {
  GET:    'bg-sky-10    text-sky    border-sky',
  POST:   'bg-green-10  text-green  border-green',
  PUT:    'bg-amber-10  text-amber  border-amber',
  PATCH:  'bg-violet-10 text-violet border-violet',
  DELETE: 'bg-rose-10   text-rose   border-rose',
  ALL:    'bg-zinc-10   text-zinc   border-zinc',
}
function MethodBadge({ method }) {
  return <span className={`method-badge method-badge--${(method||'GET').toLowerCase()}`}>{method||'GET'}</span>
}

/* ── Status badge ─────────────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const n = Number(status)
  const cls = n >= 500 ? 'rose' : n >= 400 ? 'amber' : n >= 300 ? 'sky' : 'green'
  return <span className={`status-badge status-badge--${cls}`}>{status}</span>
}

/* ── KV row ───────────────────────────────────────────────────────────────── */
function KvRow({ k, v, accent }) {
  return (
    <div className="kv-row">
      <span className="kv-row__key">{k}</span>
      <code className={`kv-row__val${accent ? ' accent' : ''}`}>{v}</code>
    </div>
  )
}

/* ── Panel shell — no duplicate add button ────────────────────────────────── */
function PanelShell({ label, counter, onAdd, addLabel, isEmpty, children }) {
  return (
    <div className="panel-shell">
      <div className="panel-shell__head">
        <span className="panel-shell__label">{label}</span>
        <span className="panel-shell__counter">{counter}</span>
      </div>
      <div className="panel-shell__body">
        {isEmpty
          ? <button className="empty-state" onClick={onAdd}>{addLabel}</button>
          : <>
              {children}
              <button className="btn-add-rule" onClick={onAdd}>{addLabel}</button>
            </>
        }
      </div>
    </div>
  )
}

/* ── Redirect panel ───────────────────────────────────────────────────────── */
function RedirectsPanel({ lang, rules, onToggle, onAdd, onEdit, onDelete }) {
  const [pending, setPending] = useState(null)
  const active = rules.filter(r => r.enabled).length
  return (
    <PanelShell label={t('panel_redirects', lang)}
      counter={`${String(active).padStart(2,'0')}/${String(rules.length).padStart(2,'0')}`}
      onAdd={onAdd} addLabel={t('add_rule', lang)} isEmpty={rules.length === 0}>
      {rules.map(r => (
        <article key={r.id} className="rule-card">
          <div className="rule-card__head">
            <div>
              <div className="rule-card__name">{r.name}</div>
              <div className="rule-card__hits">{t('stat_hits_label', lang)} · <span>{(r.hits || 0).toLocaleString()}</span></div>
            </div>
            <Toggle checked={!!r.enabled} onChange={v => onToggle(r.id, v)} label={`Toggle ${r.name}`} />
          </div>
          <KvRow k="FROM" v={r.from || ''} />
          <KvRow k="TO" v={r.to || ''} accent={!!r.enabled} />
          <div className="rule-card__actions">
            <button className="btn-edit" onClick={() => onEdit(r.id)}>{t('edit', lang)}</button>
            <button className="btn-delete" onClick={() => setPending(r.id)}>{t('delete', lang)}</button>
          </div>
        </article>
      ))}
      <ConfirmDialog lang={lang} open={!!pending}
        onCancel={() => setPending(null)}
        onConfirm={() => { if (pending) onDelete(pending); setPending(null) }} />
    </PanelShell>
  )
}

/* ── Intercept panel — accordion matching rework ──────────────────────────── */
function InterceptsPanel({ lang, rules, onToggle, onAdd, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(rules[0]?.id ?? null)
  const [pending, setPending] = useState(null)
  const active = rules.filter(r => r.enabled).length

  return (
    <PanelShell label={t('panel_intercepts', lang)}
      counter={`${String(active).padStart(2,'0')}/${String(rules.length).padStart(2,'0')}`}
      onAdd={onAdd} addLabel={t('add_mock', lang)} isEmpty={rules.length === 0}>
      {rules.map(r => {
        const open = expanded === r.id
        const method = r.method || r.httpMethod || 'GET'
        const pattern = r.pattern || r.urlPattern || ''
        const status = r.status || r.responseStatus || 200
        const body = r.body || r.responseBody || ''
        return (
          <article key={r.id} className="rule-card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Collapsed header — always visible, click to expand */}
            <button type="button"
              onClick={() => setExpanded(open ? null : r.id)}
              style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '12px', textAlign: 'left', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <MethodBadge method={method} />
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pattern}
                </code>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <StatusBadge status={status} />
                <Toggle checked={!!r.enabled} onChange={v => onToggle(r.id, v)} label={`Toggle ${r.name}`} />
              </div>
            </button>
            {/* Expanded body */}
            {open && (
              <div style={{ borderTop: '1px solid var(--hairline)', padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <KvRow k="NAME" v={r.name || ''} />
                <div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
                    {t('field_body', lang)}
                  </p>
                  <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 10, lineHeight: 1.6, color: 'oklch(0.78 0.01 270)', borderRadius: 6, border: '1px solid var(--hairline)', background: 'oklch(0.13 0.008 280 / 60%)', padding: '8px', maxHeight: 96, overflowY: 'auto' }}>
                    {body || '// empty'}
                  </pre>
                </div>
                <div className="rule-card__actions" style={{ marginTop: 0, paddingTop: 8 }}>
                  <button className="btn-edit" onClick={() => onEdit(r.id)}>{t('edit', lang)}</button>
                  <button className="btn-delete" onClick={() => setPending(r.id)}>{t('delete', lang)}</button>
                </div>
              </div>
            )}
          </article>
        )
      })}
      <ConfirmDialog lang={lang} open={!!pending}
        onCancel={() => setPending(null)}
        onConfirm={() => { if (pending) onDelete(pending); setPending(null) }} />
    </PanelShell>
  )
}

/* ── Session panel ────────────────────────────────────────────────────────── */
function SessionsPanel({ lang, sessions, onLaunch, onClose, onAdd, onEdit, onDelete }) {
  const [pending, setPending] = useState(null)
  const active = sessions.filter(s => s.active).length
  return (
    <PanelShell label={t('panel_sessions', lang)}
      counter={`${String(active).padStart(2,'0')}/${String(sessions.length).padStart(2,'0')}`}
      onAdd={onAdd} addLabel={t('add_session', lang)} isEmpty={sessions.length === 0}>
      {sessions.map(s => (
        <article key={s.id} className="rule-card"
          style={s.active ? { borderColor: 'oklch(0.82 0.15 210 / 0.3)', boxShadow: '0 0 24px -8px var(--backlight)' } : {}}>
          <div className="rule-card__head">
            <div>
              <div className="rule-card__name">{s.name}</div>
              <code style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{s.origin}</code>
            </div>
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: s.active ? 'var(--backlight)' : 'oklch(0.4 0.01 270)' }}>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '9999px', background: s.active ? 'var(--backlight)' : 'oklch(0.3 0.01 270)', marginRight: 4, verticalAlign: 'middle' }} />
              {s.active ? t('status_active', lang) : 'Idle'}
            </span>
          </div>
          <div className="rule-card__actions">
            {s.active
              ? <button className="btn-edit" style={{ flex: 1 }} onClick={() => onClose(s.id)}>{t('close', lang)}</button>
              : <button className="btn-edit" style={{ flex: 1, background: 'oklch(0.82 0.15 210/0.9)', color: 'var(--obsidian)', borderColor: 'transparent' }} onClick={() => onLaunch(s.id)}>{t('launch', lang)}</button>
            }
            <button className="btn-edit" onClick={() => onEdit(s.id)}>{t('edit', lang)}</button>
            <button className="btn-delete" onClick={() => setPending(s.id)}>{t('delete', lang)}</button>
          </div>
        </article>
      ))}
      <ConfirmDialog lang={lang} open={!!pending}
        onCancel={() => setPending(null)}
        onConfirm={() => { if (pending) onDelete(pending); setPending(null) }} />
    </PanelShell>
  )
}

/* ── Debug panel ──────────────────────────────────────────────────────────── */
function SumRow({ k, v, accent, full }) {
  return (
    <div style={{ gridColumn: full ? 'span 2' : undefined, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderRadius: 6, border: '1px solid var(--hairline)', background: 'oklch(0.13 0.008 280 / 40%)', padding: '6px 8px' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{k}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontVariantNumeric: 'tabular-nums', color: accent ? 'var(--backlight)' : 'oklch(0.85 0.005 270)' }}>{v}</span>
    </div>
  )
}

function DebugPanel({ lang, systemState, redirects, intercepts, sessions, logs, onClearLogs, onExportConfig, onImportConfig, onCopySummary, importInputRef, onImportFile }) {
  const totals = {
    redirects: redirects.length, intercepts: intercepts.length, sessions: sessions.length,
    activeRedirects: redirects.filter(r => r.enabled).length,
    activeIntercepts: intercepts.filter(r => r.enabled).length,
    activeSessions: sessions.filter(s => s.active).length,
    hits: redirects.reduce((s, r) => s + (r.hits || 0), 0),
  }
  return (
    <div className="panel-shell">
      <div className="panel-shell__head">
        <span className="panel-shell__label">{t('panel_debug', lang)}</span>
        <span className="panel-shell__counter">{String(logs.length).padStart(3, '0')}</span>
      </div>
      <div className="panel-shell__body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button className="debug-action-btn" onClick={onExportConfig}>↓ {t('debug_export', lang)}</button>
          <button className="debug-action-btn" onClick={onImportConfig}>↑ {t('debug_import', lang)}</button>
          <button className="debug-action-btn" onClick={onCopySummary} style={{ gridColumn: 'span 2' }}>⧉ {t('debug_copy_summary', lang)}</button>
          <input ref={importInputRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={onImportFile} />
        </div>
        <section className="rule-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="panel-shell__label">{t('debug_summary', lang)}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: systemState === 'off' ? 'oklch(0.4 0.01 270)' : systemState === 'intercepting' ? 'var(--warn)' : 'var(--backlight)' }}>{systemState}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <SumRow k={t('debug_total_redirects', lang)}   v={totals.redirects} />
            <SumRow k={t('debug_active_redirects', lang)}  v={totals.activeRedirects} accent />
            <SumRow k={t('debug_total_intercepts', lang)}  v={totals.intercepts} />
            <SumRow k={t('debug_active_intercepts', lang)} v={totals.activeIntercepts} accent />
            <SumRow k={t('debug_total_sessions', lang)}    v={totals.sessions} />
            <SumRow k={t('debug_active_sessions', lang)}   v={totals.activeSessions} accent />
            <SumRow k={t('debug_total_hits', lang)} v={totals.hits.toLocaleString()} accent full />
          </div>
        </section>
        <section className="rule-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--hairline)' }}>
            <span className="panel-shell__label">{t('debug_logs', lang)}</span>
            <button className="btn-delete" style={{ padding: '2px 8px' }} onClick={onClearLogs}>{t('debug_clear', lang)}</button>
          </div>
          <div style={{ maxHeight: 160, overflowY: 'auto', padding: 8 }}>
            {logs.length === 0
              ? <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', textAlign: 'center', padding: '16px 0' }}>{t('debug_no_logs', lang)}</p>
              : logs.map(entry => (
                <div key={entry.id} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, lineHeight: 1.6, borderBottom: '1px solid var(--hairline)', padding: '3px 0', color: entry.level === 'error' ? 'var(--rose, #f87171)' : entry.level === 'warn' ? 'var(--warn, #fbbf24)' : 'oklch(0.78 0.01 270)' }}>
                  <span style={{ opacity: 0.5, marginRight: 6 }}>[{entry.scope}]</span>
                  {entry.message}
                </div>
              ))
            }
          </div>
        </section>
      </div>
    </div>
  )
}

/* ── Main AppShell ────────────────────────────────────────────────────────── */
export function AppShell({ state, onLanguageChange, onRefresh }) {
  const [lang, setLang] = useState(getStoredLanguage())
  const [tab, setTab] = useState('redirect')
  const [systemOn, setSystemOn] = useState(getStoredSystemOn)
  // Redirect/intercept state is seeded from store snapshot, then updated locally after CRUD
  const [redirects, setRedirects] = useState(() => state?.redirects || [])
  const [intercepts, setIntercepts] = useState(() => state?.intercepts || [])
  const [sessions, setSessions] = useState(() => state?.sessions || [])
  const [logs, setLogs] = useState(() => state?.logs || [])
  const [editor, setEditor] = useState(null)
  const [loading, setLoading] = useState(!state?.redirects)

  // ── Sync from store when it delivers live updates (storage.onChanged) ────
  const prevStateRef = useRef(state)
  const importInputRef = useRef(null)
  useEffect(() => {
    if (state && state !== prevStateRef.current) {
      prevStateRef.current = state
      if (!editor) {
        // Only sync list state when editor is not open to avoid overwriting draft
        if (Array.isArray(state.redirects)) setRedirects(state.redirects)
        if (Array.isArray(state.intercepts)) setIntercepts(state.intercepts)
      }
      if (Array.isArray(state.sessions)) setSessions(state.sessions)
      if (Array.isArray(state.logs)) setLogs(state.logs)
      setLoading(false)
    }
  }, [state, editor])

  // ── Fallback boot: direct fetch if store snapshot was empty ─────────────
  useEffect(() => {
    if (loading) {
      Promise.all([listRedirectConfigs(), listInterceptConfigs(), getIsolatedTabs()]).then(([r, i, s]) => {
        if (r.ok) setRedirects(r.data || [])
        if (i.ok) setIntercepts(i.data || [])
        if (s.ok) setSessions(s.data?.isolatedTabs || [])
        setLogs(listDebugLogs())
        setLoading(false)
      }).catch(() => setLoading(false))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const activeRules = redirects.filter(r => r.enabled).length + intercepts.filter(r => r.enabled).length
  const activeSessions = sessions.filter(s => s.active).length
  const totalHits = redirects.reduce((sum, r) => sum + (r.hits || 0), 0)
  const systemState = !systemOn ? 'off' : activeRules > 0 ? 'intercepting' : 'on'

  const handleLang = useCallback((key) => {
    setLang(key); setStoredLanguage(key); onLanguageChange?.(key)
  }, [onLanguageChange])

  const updateSystemOn = useCallback((value) => {
    setSystemOn(value)
    setStoredSystemOn(value)
  }, [])

  // Refresh logs from in-memory buffer + storage runtime logs after any CRUD op or tab switch
  const refreshLogs = useCallback(async () => {
    const merged = await listAllLogs()
    setLogs(merged)
  }, [])

  // When switching to debug tab, immediately pull fresh verbose logs from storage
  const handleTabChange = useCallback((key) => {
    setTab(key)
    if (key === 'debug') refreshLogs()
  }, [refreshLogs])

  // ── Debug toolkit actions ─────────────────────────────────────────────────
  const handleExportConfig = useCallback(async () => {
    const result = await exportConfigSnapshot()
    if (!result.ok) {
      pushDebugLog('error', 'debug', 'Failed exporting config snapshot', result.error)
      await refreshLogs()
      return
    }

    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `basuki-config-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    pushDebugLog('info', 'debug', 'Exported config snapshot')
    await refreshLogs()
  }, [refreshLogs])

  const handleCopySummary = useCallback(async () => {
    const result = await buildCopySummary()
    if (!result.ok) {
      pushDebugLog('error', 'debug', 'Failed copying debug summary', result.error)
      await refreshLogs()
      return
    }

    try {
      await navigator.clipboard.writeText(result.data)
      pushDebugLog('info', 'debug', 'Copied debug summary to clipboard')
    } catch (error) {
      pushDebugLog('error', 'debug', 'Clipboard write failed for debug summary', error)
    }
    await refreshLogs()
  }, [refreshLogs])

  const handleImportConfig = useCallback(() => {
    importInputRef.current?.click()
  }, [])

  const handleImportFile = useCallback(async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const parsed = JSON.parse(await file.text())
      const result = await importConfigSnapshot(parsed)
      if (result.ok) {
        onRefresh?.(['redirect', 'intercept', 'session', 'debug'])
      }
    } catch (error) {
      pushDebugLog('error', 'debug', 'Invalid JSON import file', error)
    } finally {
      event.target.value = ''
      await refreshLogs()
    }
  }, [onRefresh, refreshLogs])

  // ── Redirect CRUD (persisted) ─────────────────────────────────────────────
  const addRedirect = async () => {
    // Draft starts disabled — user must explicitly enable after configuring
    const draft = { id: Date.now(), name: 'New Redirect', from: 'https://example.com/*', to: 'http://localhost:3000', enabled: false, hits: 0 }
    const res = await addRedirectConfig(draft)
    if (res.ok) setRedirects(res.data)
    setEditor({ kind: 'redirect', id: draft.id, isNew: true })
    pushDebugLog('info', 'redirect', `Created draft redirect: ${draft.name}`)
    refreshLogs()
  }
  const saveRedirect = async (next) => {
    const res = await updateRedirectConfig(next.id, next)
    if (res.ok) setRedirects(res.data)
    setEditor(null)
    pushDebugLog('info', 'redirect', `Saved redirect: ${next.name} (${next.from} → ${next.to})`)
    refreshLogs()
    onRefresh?.(['redirect'])
  }
  const deleteRedirect = async (id) => {
    const res = await deleteRedirectConfig(id)
    if (res.ok) setRedirects(res.data)
    // Only close editor if it was editing the specific deleted rule
    if (editor?.id === id) setEditor(null)
    pushDebugLog('warn', 'redirect', `Deleted redirect id=${id}`)
    refreshLogs()
    onRefresh?.(['redirect'])
  }
  const toggleRedirect = async (id, enabled) => {
    const res = await toggleRedirectEnabled(id, enabled)
    if (res.ok) setRedirects(res.data)
    pushDebugLog('info', 'redirect', `Toggled redirect id=${id} → ${enabled ? 'enabled' : 'disabled'}`)
    refreshLogs()
    onRefresh?.(['redirect'])
  }

  // ── Intercept CRUD (persisted) ────────────────────────────────────────────
  const addIntercept = async () => {
    // Draft starts disabled — user must explicitly enable after configuring
    const draft = { id: Date.now(), name: 'New Mock', method: 'GET', pattern: '/api/example', status: 200, body: '{}', enabled: false }
    const res = await addInterceptConfig(draft)
    if (res.ok) setIntercepts(res.data)
    setEditor({ kind: 'intercept', id: draft.id, isNew: true })
    pushDebugLog('info', 'intercept', `Created draft intercept: ${draft.name}`)
    refreshLogs()
  }
  const saveIntercept = async (next) => {
    const res = await updateInterceptConfig(next.id, next)
    if (res.ok) setIntercepts(res.data)
    setEditor(null)
    pushDebugLog('info', 'intercept', `Saved intercept: ${next.name}`)
    refreshLogs()
    onRefresh?.(['intercept'])
  }
  const deleteIntercept = async (id) => {
    const res = await deleteInterceptConfig(id)
    if (res.ok) setIntercepts(res.data)
    if (editor?.kind === 'intercept' && editor?.id === id) setEditor(null)
    pushDebugLog('warn', 'intercept', `Deleted intercept id=${id}`)
    refreshLogs()
    onRefresh?.(['intercept'])
  }
  const toggleIntercept = async (id, enabled) => {
    const res = await toggleInterceptEnabled(id, enabled)
    if (res.ok) setIntercepts(res.data)
    pushDebugLog('info', 'intercept', `Toggled intercept id=${id} → ${enabled ? 'enabled' : 'disabled'}`)
    refreshLogs()
    onRefresh?.(['intercept'])
  }

  const pauseAllRules = async () => {
    const activeRedirects = redirects.filter(r => r.enabled)
    const activeIntercepts = intercepts.filter(r => r.enabled)
    setStoredPausedRules({
      redirects: activeRedirects.map(r => r.id),
      intercepts: activeIntercepts.map(r => r.id),
    })
    if (activeRedirects.length === 0 && activeIntercepts.length === 0) {
      updateSystemOn(false)
      return
    }

    let latestRedirects = redirects
    let latestIntercepts = intercepts

    for (const r of activeRedirects) {
      const res = await toggleRedirectEnabled(r.id, false)
      if (res.ok) latestRedirects = res.data
    }
    for (const i of activeIntercepts) {
      const res = await toggleInterceptEnabled(i.id, false)
      if (res.ok) latestIntercepts = res.data
    }

    setRedirects(latestRedirects)
    setIntercepts(latestIntercepts)
    updateSystemOn(false)
    pushDebugLog('warn', 'system', `Pause All applied (${activeRedirects.length} redirects, ${activeIntercepts.length} intercepts disabled)`)
    refreshLogs()
    onRefresh?.(['redirect', 'intercept'])
  }

  const resumeRules = async () => {
    const pausedRules = getStoredPausedRules()
    let latestRedirects = redirects
    let latestIntercepts = intercepts
    let restoredRedirects = 0
    let restoredIntercepts = 0

    for (const id of pausedRules.redirects) {
      const res = await toggleRedirectEnabled(id, true)
      if (res.ok) {
        latestRedirects = res.data
        restoredRedirects += 1
      }
    }
    for (const id of pausedRules.intercepts) {
      const res = await toggleInterceptEnabled(id, true)
      if (res.ok) {
        latestIntercepts = res.data
        restoredIntercepts += 1
      }
    }

    setRedirects(latestRedirects)
    setIntercepts(latestIntercepts)
    clearStoredPausedRules()
    updateSystemOn(true)
    pushDebugLog('info', 'system', `Resume All restored ${restoredRedirects} redirects and ${restoredIntercepts} intercepts`)
    refreshLogs()
    onRefresh?.(['redirect', 'intercept'])
  }

  // ── Session CRUD (runtime-managed) ─────────────────────────────────────────
  const refreshSessions = useCallback(async () => {
    const refreshed = await getIsolatedTabs()
    if (refreshed.ok) {
      setSessions(refreshed.data?.isolatedTabs || [])
    }
    return refreshed
  }, [])

  const addSession = () => {
    const draft = {
      id: `draft-${Date.now()}`,
      isolationId: null,
      name: 'New Session',
      origin: 'example.com',
      url: 'https://example.com',
      cleanState: true,
      userAgent: 'Desktop/Chrome',
      active: false,
      isDraft: true,
    }
    setSessions(prev => [...prev, draft])
    setEditor({ kind: 'session', id: draft.id, isNew: true })
  }
  const saveSession = async (next) => {
    if (next.isolationId) {
      await renameIsolatedTab(next.isolationId || next.id, next.name)
      pushDebugLog('info', 'session', `Renamed isolated session: ${next.name}`)
      await refreshSessions()
      await refreshLogs()
      onRefresh?.(['session', 'debug'])
    } else {
      // Backend only persists runtime isolation metadata; draft-only fields stay local until launch.
      setSessions(prev => prev.map(s => s.id === next.id ? next : s))
    }
    setEditor(null)
  }
  const deleteSession = async (id) => {
    const session = sessions.find(s => s.id === id)
    if (session?.isolationId) {
      await removeIsolatedTab(session.isolationId || id)
      pushDebugLog('warn', 'session', `Deleted isolated session: ${session.name}`)
      await refreshSessions()
      await refreshLogs()
      onRefresh?.(['session', 'debug'])
    } else {
      setSessions(prev => prev.filter(s => s.id !== id))
    }
    if (editor?.kind === 'session' && editor?.id === id) setEditor(null)
  }
  const launchSession = async (id) => {
    const session = sessions.find(s => s.id === id)
    if (!session) return

    if (session.isolationId) {
      await activateIsolatedTab(session.isolationId)
      pushDebugLog('info', 'session', `Activated isolated session: ${session.name}`)
    } else {
      await createIsolatedTab(session.url || session.origin)
      pushDebugLog('info', 'session', `Created isolated session from ${session.url || session.origin}`)
      if (session.isDraft) setEditor(null)
    }

    await refreshSessions()
    await refreshLogs()
    onRefresh?.(['session', 'debug'])
  }
  const closeSession = async (id) => {
    const session = sessions.find(s => s.id === id)
    if (!session?.isolationId) return

    await removeIsolatedTab(session.isolationId)
    pushDebugLog('warn', 'session', `Closed isolated session: ${session.name}`)
    await refreshSessions()
    await refreshLogs()
    onRefresh?.(['session', 'debug'])
  }

  const editingRedirect = editor?.kind === 'redirect' ? redirects.find(r => r.id === editor.id) : undefined
  const editingIntercept = editor?.kind === 'intercept' ? intercepts.find(r => r.id === editor.id) : undefined
  const editingSession = editor?.kind === 'session' ? sessions.find(s => s.id === editor.id) : undefined

  return (
    <div className="popup-root">
      <header className="popup-header">
        <div className="popup-header__left">
          <button className="popup-icon-btn" onClick={() => updateSystemOn(!systemOn)} aria-label={t('toggle_system', lang)}>
            <BasukiIcon state={systemState} />
          </button>
          <div className="popup-brand">
            <div className="popup-brand__name">BASUKI<span>v{MANIFEST_VERSION}</span></div>
            <div className="popup-brand__status">
              {systemState === 'off' ? t('status_paused', lang) : systemState === 'intercepting' ? t('status_intercepting', lang) : t('status_active', lang)}
            </div>
          </div>
        </div>
        <div className="lang-switch">
          {LANGS.map(l => (
            <button key={l.key} className={`lang-switch__btn${lang === l.key ? ' active' : ''}`} onClick={() => handleLang(l.key)}>{l.label}</button>
          ))}
        </div>
      </header>

      <nav className="popup-tabs" role="tablist">
        {TABS.map(tb => (
          <button key={tb.key} role="tab" aria-selected={tab === tb.key}
            className={`popup-tabs__btn${tab === tb.key ? ' active' : ''}`}
            onClick={() => handleTabChange(tb.key)}>
            {t(tb.tKey, lang)}
          </button>
        ))}
      </nav>

      <div className="popup-body" role="tabpanel">
        {!loading && tab === 'redirect' && (
          <RedirectsPanel lang={lang} rules={redirects}
            onToggle={toggleRedirect} onAdd={addRedirect}
            onEdit={id => setEditor({ kind: 'redirect', id, isNew: false })}
            onDelete={deleteRedirect} />
        )}
        {!loading && tab === 'intercept' && (
          <InterceptsPanel lang={lang} rules={intercepts}
            onToggle={toggleIntercept} onAdd={addIntercept}
            onEdit={id => setEditor({ kind: 'intercept', id, isNew: false })}
            onDelete={deleteIntercept} />
        )}
        {tab === 'session' && (
          <SessionsPanel lang={lang} sessions={sessions}
            onLaunch={launchSession} onClose={closeSession}
            onAdd={addSession}
            onEdit={id => setEditor({ kind: 'session', id, isNew: false })}
            onDelete={deleteSession} />
        )}
        {tab === 'debug' && (
          <DebugPanel lang={lang} systemState={systemState}
            redirects={redirects} intercepts={intercepts} sessions={sessions}
            logs={logs}
            onClearLogs={async () => {
              clearDebugLogs()
              await clearRuntimeLogs()
              setLogs([])
              pushDebugLog('info', 'debug', 'Cleared popup and runtime logs')
              await refreshLogs()
              onRefresh?.(['debug'])
            }}
            onExportConfig={handleExportConfig}
            onImportConfig={handleImportConfig}
            onCopySummary={handleCopySummary}
            importInputRef={importInputRef}
            onImportFile={handleImportFile} />
        )}

        {editingRedirect && editor?.kind === 'redirect' && (
          <RedirectEditor lang={lang} rule={editingRedirect} isNew={editor.isNew}
            onSave={saveRedirect}
            onDelete={() => deleteRedirect(editingRedirect.id)}
            onClose={() => editor.isNew ? deleteRedirect(editingRedirect.id) : setEditor(null)} />
        )}
        {editingIntercept && editor?.kind === 'intercept' && (
          <InterceptEditor lang={lang} rule={editingIntercept} isNew={editor.isNew}
            onSave={saveIntercept}
            onDelete={() => deleteIntercept(editingIntercept.id)}
            onClose={() => editor.isNew ? deleteIntercept(editingIntercept.id) : setEditor(null)} />
        )}
        {editingSession && editor?.kind === 'session' && (
          <SessionEditor lang={lang} session={editingSession} isNew={editor.isNew}
            onSave={saveSession}
            onDelete={() => deleteSession(editingSession.id)}
            onClose={() => editor.isNew ? deleteSession(editingSession.id) : setEditor(null)} />
        )}
      </div>

      <footer className="popup-footer">
        <div className="popup-footer__stats">
          <div className="popup-stat">
            <span className="popup-stat__label">{t('stat_rules', lang)}</span>
            <span className="popup-stat__value">{String(activeRules).padStart(2, '0')}</span>
          </div>
          <div className="popup-stat">
            <span className="popup-stat__label">{t('stat_sessions', lang)}</span>
            <span className="popup-stat__value">{String(activeSessions).padStart(2, '0')}</span>
          </div>
          <div className="popup-stat">
            <span className="popup-stat__label">{t('stat_hits', lang)}</span>
            <span className="popup-stat__value accent">{totalHits.toLocaleString()}</span>
          </div>
        </div>
        <div className="popup-footer__actions">
          <button className={`btn-pause-all${systemOn ? '' : ' resume'}`} onClick={() => { if (systemOn) pauseAllRules(); else resumeRules() }} title={systemOn ? 'Pause all active rules' : 'Resume all rules'}>
            <span className="btn-pause-all__dot" />
            {systemOn ? t('footer_quick_toggle', lang) : t('footer_quick_resume', lang)}
          </button>
        </div>
      </footer>
    </div>
  )
}
