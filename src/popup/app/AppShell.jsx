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
  loadTraffic,
  clearTraffic,
  exportConfigSnapshot,
  importConfigSnapshot,
  buildCopySummary,
} from '../adapters/debugAdapter.js'
import { setSystemEnabled } from '../adapters/systemAdapter.js'
import { listDrafts, removeDraft } from '../adapters/draftAdapter.js'
import { listSessionPresets, removeSessionPreset, saveSessionPreset } from '../adapters/sessionPresetAdapter.js'
import { validateSessionOrigin } from '../utils/validation.js'
import { validateImportSnapshot } from '../utils/importValidation.js'
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
const MANIFEST_VERSION = chrome.runtime.getManifest().version

function relativeTime(timestamp, lang) {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (seconds < 60) return t('time_seconds', lang, { value: seconds })
  const minutes = Math.round(seconds / 60)
  return t('time_minutes', lang, { value: minutes })
}

function Toast({ message }) {
  if (!message) return null
  return <div className="popup-toast" role="status" aria-live="polite">{message}</div>
}

function errorText(error) {
  return error?.message || error?.error || 'Operation failed. Try again.'
}

function isStaleNoMatch(rule) {
  const timestamp = rule.createdAt || rule.updatedAt || 0
  return timestamp > 0 && Date.now() - timestamp > 300000
}

function mergeSessions(runtimeSessions, presets) {
  const runtime = Array.isArray(runtimeSessions) ? runtimeSessions : []
  const savedPresets = Array.isArray(presets) ? presets : []
  const runtimeIds = new Set(runtime.map(session => String(session.isolationId || session.id)))
  return [
    ...runtime,
    ...savedPresets.filter(preset => !runtimeIds.has(String(preset.id))),
  ]
}

/* ── Toggle ───────────────────────────────────────────────────────────────── */
function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
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
    <img src={src} alt=""
      style={{ width: 32, height: 32, objectFit: 'contain', imageRendering: 'crisp-edges' }} />
  )
}

/* ── Method badge ─────────────────────────────────────────────────────────── */
function MethodBadge({ method }) {
  return <span className={`method-badge method-badge--${(method||'GET').toLowerCase()}`}>{method||'GET'}</span>
}

/* ── Status badge ─────────────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const n = Number(status)
  const cls = !Number.isFinite(n) ? 'rose' : n >= 500 ? 'rose' : n >= 400 ? 'amber' : n >= 300 ? 'sky' : 'green'
  return <span className={`status-badge status-badge--${cls}`}>{status}</span>
}

/* ── KV row ───────────────────────────────────────────────────────────────── */
function KvRow({ k, v, accent }) {
  return (
    <div className="kv-row">
      <span className="kv-row__key">{k}</span>
      <code title={v} className={`kv-row__val${accent ? ' accent' : ''}`}>{v}</code>
    </div>
  )
}

/* ── Panel shell — no duplicate add button ────────────────────────────────── */
function PanelShell({ label, description, counter, onAdd, addLabel, isEmpty, children }) {
  return (
    <div className="panel-shell">
      <div className="panel-shell__head">
        <span className="panel-shell__label">{label}</span>
        <span className="panel-shell__counter">{counter}</span>
      </div>
      <div className="panel-shell__body">
        {isEmpty
          ? <>
              {description && <p className="empty-state__description">{description}</p>}
              <button className="empty-state" onClick={onAdd}>{addLabel}</button>
            </>
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
function RedirectsPanel({ lang, systemOn, pending, rules, onToggle, onAdd, onEdit, onDelete }) {
  const [deletePending, setDeletePending] = useState(null)
  const active = rules.filter(r => r.enabled).length
  return (
    <PanelShell label={t('panel_redirects', lang)}
      description={rules.length === 0 ? t('empty_redirects', lang) : undefined}
      counter={`${active}/${rules.length}`}
      onAdd={onAdd} addLabel={t('add_rule', lang)} isEmpty={rules.length === 0}>
      {rules.map(r => (
        <article key={r.id} className={`rule-card${!systemOn && r.enabled ? ' system-paused' : ''}`}>
          <div className="rule-card__head">
            <div>
              <div className="rule-card__name">{r.name}</div>
             <div className="rule-card__hits" title={r.lastHitAt ? new Date(r.lastHitAt).toLocaleString() : undefined}>{t('stat_hits_label', lang)} · <span>{(r.hits || 0).toLocaleString()}</span>{r.lastHitAt && ` · ${relativeTime(r.lastHitAt, lang)}`}</div>
            </div>
             <Toggle checked={!!r.enabled} disabled={pending} onChange={v => onToggle(r.id, v)} label={`Toggle ${r.name}`} />
          </div>
           <KvRow k="FROM" v={r.from || ''} />
           <KvRow k="TO" v={r.to || ''} accent={!!r.enabled && systemOn} />
           {systemOn && r.enabled && !r.hits && isStaleNoMatch(r) && <p className="rule-card__hint">{t('no_matches_yet', lang)}</p>}
          <div className="rule-card__actions">
            <button className="btn-edit" onClick={() => onEdit(r.id)}>{t('edit', lang)}</button>
             <button className="btn-delete" onClick={() => setDeletePending(r.id)}>{t('delete', lang)}</button>
          </div>
        </article>
      ))}
       <ConfirmDialog lang={lang} open={!!deletePending}
         onCancel={() => setDeletePending(null)}
         onConfirm={() => { if (deletePending) onDelete(deletePending); setDeletePending(null) }} />
    </PanelShell>
  )
}

/* ── Intercept panel — accordion matching rework ──────────────────────────── */
function InterceptsPanel({ lang, systemOn, pending, rules, onToggle, onAdd, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(null)
  const [deletePending, setDeletePending] = useState(null)
  const active = rules.filter(r => r.enabled).length

  return (
    <PanelShell label={t('panel_intercepts', lang)}
      description={rules.length === 0 ? t('empty_intercepts', lang) : undefined}
      counter={`${active}/${rules.length}`}
      onAdd={onAdd} addLabel={t('add_mock', lang)} isEmpty={rules.length === 0}>
      {rules.map(r => {
        const open = expanded === r.id
        const method = r.method || r.httpMethod || 'GET'
        const pattern = r.pattern || r.urlPattern || ''
        const status = r.status || r.responseStatus || 200
        const body = r.body || r.responseBody || ''
        return (
          <article key={r.id} className={`rule-card accordion-card${!systemOn && r.enabled ? ' system-paused' : ''}`}>
            {/* Collapsed header — always visible, click to expand */}
             <div className="accordion-row">
             <button type="button" className="accordion-row__expand"
               onClick={() => setExpanded(open ? null : r.id)}
               aria-expanded={open}>
               <div className="accordion-row__pattern">
                 <MethodBadge method={method} />
                 <code title={pattern}>{pattern}</code>
               </div>
             </button>
             <div className="accordion-row__meta">
                 <StatusBadge status={status} />
                  <Toggle checked={!!r.enabled} disabled={pending} onChange={v => onToggle(r.id, v)} label={`Toggle ${r.name}`} />
               </div>
             </div>
            {/* Expanded body */}
            {open && (
              <div className="accordion-body">
                 <KvRow k="NAME" v={r.name || ''} />
                 <div className="rule-card__hits">{t('stat_hits_label', lang)} · <span>{(r.hits || 0).toLocaleString()}</span>{r.lastHitAt && ` · ${relativeTime(r.lastHitAt, lang)}`}</div>
                <div>
                   <p className="accordion-body__label">
                    {t('field_body', lang)}
                  </p>
                   <pre className="accordion-body__preview">
                     {body || t('empty_body', lang)}
                  </pre>
                </div>
                 <div className="rule-card__actions accordion-body__actions">
                  <button className="btn-edit" onClick={() => onEdit(r.id)}>{t('edit', lang)}</button>
                   <button className="btn-delete" onClick={() => setDeletePending(r.id)}>{t('delete', lang)}</button>
                </div>
              </div>
            )}
          </article>
        )
      })}
       <ConfirmDialog lang={lang} open={!!deletePending}
         onCancel={() => setDeletePending(null)}
         onConfirm={() => { if (deletePending) onDelete(deletePending); setDeletePending(null) }} />
    </PanelShell>
  )
}

/* ── Session panel ────────────────────────────────────────────────────────── */
function SessionsPanel({ lang, sessions, onLaunch, onClose, onAdd, onEdit, onDelete }) {
  const [pending, setPending] = useState(null)
  const active = sessions.filter(s => s.active).length
  return (
    <PanelShell label={t('panel_sessions', lang)}
      description={sessions.length === 0 ? t('empty_sessions', lang) : undefined}
      counter={`${active}/${sessions.length}`}
      onAdd={onAdd} addLabel={t('add_session', lang)} isEmpty={sessions.length === 0}>
      {sessions.map(s => (
        <article key={s.id} className="rule-card"
          style={s.active ? { borderColor: 'oklch(0.82 0.15 210 / 0.3)', boxShadow: '0 0 24px -8px var(--backlight)' } : {}}>
          <div className="rule-card__head">
            <div>
              <div className="rule-card__name">{s.name}</div>
             <code title={s.origin} style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{s.origin}</code>
            </div>
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: s.active ? 'var(--backlight)' : 'oklch(0.4 0.01 270)' }}>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '9999px', background: s.active ? 'var(--backlight)' : 'oklch(0.3 0.01 270)', marginRight: 4, verticalAlign: 'middle' }} />
               {s.active ? t('status_active', lang) : t('status_idle', lang)}
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

function DebugPanel({ lang, systemState, redirects, intercepts, sessions, logs, traffic, onClearTraffic, onOpenInspector, onClearLogs, onExportConfig, onImportConfig, onCopySummary, importInputRef, onImportFile }) {
  const totals = {
    redirects: redirects.length, intercepts: intercepts.length, sessions: sessions.length,
    activeRedirects: redirects.filter(r => r.enabled).length,
    activeIntercepts: intercepts.filter(r => r.enabled).length,
    activeSessions: sessions.filter(s => s.active).length,
     hits: [...redirects, ...intercepts].reduce((s, r) => s + (r.hits || 0), 0),
  }
  return (
    <div className="panel-shell">
      <div className="panel-shell__head">
        <span className="panel-shell__label">{t('panel_debug', lang)}</span>
        <span className="panel-shell__counter">{String(logs.length).padStart(3, '0')}</span>
      </div>
      <div className="panel-shell__body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
           <button className="debug-action-btn" onClick={onExportConfig}>{t('debug_export', lang)}</button>
           <button className="debug-action-btn" onClick={onImportConfig}>{t('debug_import', lang)}</button>
           <button className="debug-action-btn" onClick={onCopySummary} style={{ gridColumn: 'span 2' }}>{t('debug_copy_summary', lang)}</button>
          <input ref={importInputRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={onImportFile} />
        </div>
        <section className="rule-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="panel-shell__label">{t('debug_summary', lang)}</span>
             <span className="debug-system-state">{t(`system_${systemState}`, lang)}</span>
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
         <section className="rule-card debug-traffic-summary">
           <span className="panel-shell__label">{t('debug_traffic', lang)}</span>
           <strong>{traffic.length} {t('debug_relayed', lang)} · {traffic.filter(entry => !entry.ok).length} {t('debug_failed', lang)}</strong>
           <button className="debug-action-btn" onClick={onOpenInspector}>{t('debug_open_inspector', lang)}</button>
         </section>
      </div>
    </div>
  )
}

/* ── Main AppShell ────────────────────────────────────────────────────────── */
export function AppShell({ state, onLanguageChange, onRefresh }) {
  const [lang, setLang] = useState(getStoredLanguage())
  const [tab, setTab] = useState('redirect')
  const [systemOn, setSystemOn] = useState(() => state?.systemEnabled !== false)
  // Redirect/intercept state is seeded from store snapshot, then updated locally after CRUD
  const [redirects, setRedirects] = useState(() => state?.redirects || [])
  const [intercepts, setIntercepts] = useState(() => state?.intercepts || [])
  const [sessions, setSessions] = useState(() => state?.sessions || [])
  const [sessionPresets, setSessionPresets] = useState([])
  const [draftRecovery, setDraftRecovery] = useState([])
  const [logs, setLogs] = useState(() => state?.logs || [])
  const [traffic, setTraffic] = useState([])
  const [editor, setEditor] = useState(null)
  const [toast, setToast] = useState('')
  const [pending, setPending] = useState(false)
  const toastTimerRef = useRef(null)
  const [loading, setLoading] = useState(!state?.redirects)

  // ── Sync from store when it delivers live updates (storage.onChanged) ────
  const prevStateRef = useRef(state)
  const importInputRef = useRef(null)
  useEffect(() => {
    Promise.all([listSessionPresets(), listDrafts()]).then(([presets, drafts]) => {
      setSessionPresets(presets)
      setSessions(current => mergeSessions(current, presets))
      setDraftRecovery(Object.values(drafts).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)))
    }).catch(() => {})
  }, [])
  useEffect(() => {
    if (state && state !== prevStateRef.current) {
      prevStateRef.current = state
      if (!editor) {
        // Only sync list state when editor is not open to avoid overwriting draft
        if (Array.isArray(state.redirects)) setRedirects(state.redirects)
        if (Array.isArray(state.intercepts)) setIntercepts(state.intercepts)
      }
      if (Array.isArray(state.sessions)) setSessions(mergeSessions(state.sessions, sessionPresets))
      if (Array.isArray(state.logs)) setLogs(state.logs)
      if (typeof state.systemEnabled === 'boolean') setSystemOn(state.systemEnabled)
      setLoading(false)
    }
  }, [state, editor, sessionPresets])

  const showToast = useCallback((message) => {
    setToast(message)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(''), 2600)
  }, [])

  // ── Fallback boot: direct fetch if store snapshot was empty ─────────────
  useEffect(() => {
    if (loading) {
      Promise.all([listRedirectConfigs(), listInterceptConfigs(), getIsolatedTabs()]).then(([r, i, s]) => {
        if (r.ok) setRedirects(r.data || [])
        if (i.ok) setIntercepts(i.data || [])
        if (s.ok) setSessions(mergeSessions(s.data?.isolatedTabs || [], sessionPresets))
        setLogs(listDebugLogs())
        setLoading(false)
      }).catch(() => setLoading(false))
    }
  }, [sessionPresets])

  const activeRules = redirects.filter(r => r.enabled).length + intercepts.filter(r => r.enabled).length
  const activeSessions = sessions.filter(s => s.active).length
  const totalHits = [...redirects, ...intercepts].reduce((sum, r) => sum + (r.hits || 0), 0)
  const systemState = !systemOn ? 'off' : activeRules > 0 ? 'intercepting' : 'on'
  const tabCounts = { redirect: activeRules === 0 ? 0 : redirects.filter(r => r.enabled).length, intercept: intercepts.filter(r => r.enabled).length, session: activeSessions, debug: logs.length }

  const handleLang = useCallback((key) => {
    setLang(key); setStoredLanguage(key); onLanguageChange?.(key)
  }, [onLanguageChange])

  const updateSystemOn = useCallback(async (value) => {
    if (pending) return false
    setPending(true)
    const result = await setSystemEnabled(value)
    setPending(false)
    if (!result.ok) {
      showToast(errorText(result.error))
      return false
    }
    setSystemOn(value)
    showToast(t(value ? 'toast_resumed' : 'toast_paused', lang))
    return true
  }, [lang, pending, showToast])

  // Refresh logs from in-memory buffer + storage runtime logs after any CRUD op or tab switch
  const refreshLogs = useCallback(async () => {
    const [merged, localTraffic] = await Promise.all([listAllLogs(), loadTraffic()])
    setLogs(merged)
    setTraffic(localTraffic)
  }, [])

  const handleClearTraffic = useCallback(async () => {
    const result = await clearTraffic()
    if (!result?.ok) {
      showToast(errorText(result.error))
      return
    }
    setTraffic([])
  }, [showToast])

  const handleOpenInspector = useCallback(() => {
    chrome.runtime.sendMessage({ action: 'openInspector' }, () => {
      if (chrome.runtime.lastError) {
        pushDebugLog('error', 'debug', 'Failed opening traffic inspector', chrome.runtime.lastError.message)
        showToast(chrome.runtime.lastError.message)
      }
    })
  }, [showToast])

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
      showToast(errorText(result.error))
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
    showToast(t('toast_exported', lang))
    await refreshLogs()
  }, [lang, refreshLogs, showToast])

  const handleCopySummary = useCallback(async () => {
    const result = await buildCopySummary()
    if (!result.ok) {
      pushDebugLog('error', 'debug', 'Failed copying debug summary', result.error)
      showToast(errorText(result.error))
      await refreshLogs()
      return
    }

    try {
      await navigator.clipboard.writeText(result.data)
      pushDebugLog('info', 'debug', 'Copied debug summary to clipboard')
      showToast(t('toast_copied', lang))
    } catch (error) {
      pushDebugLog('error', 'debug', 'Clipboard write failed for debug summary', error)
      showToast(errorText(error))
    }
    await refreshLogs()
  }, [lang, refreshLogs, showToast])

  const handleImportConfig = useCallback(() => {
    importInputRef.current?.click()
  }, [])

  const handleImportFile = useCallback(async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const parsed = JSON.parse(await file.text())
      const validation = validateImportSnapshot(parsed)
      if (!validation.ok) {
        showToast(validation.error)
        return
      }
  const { redirects, intercepts, sessions } = validation.counts
      const confirmed = window.confirm(t('confirm_import', lang)
        .replace('{redirects}', redirects)
        .replace('{intercepts}', intercepts)
        .replace('{sessions}', sessions))
      if (!confirmed) return
      setPending(true)
      const result = await importConfigSnapshot(parsed)
      if (result.ok) {
        showToast(t('toast_imported', lang))
        onRefresh?.(['redirect', 'intercept', 'session', 'debug'])
      } else showToast(errorText(result.error))
      setPending(false)
    } catch (error) {
      pushDebugLog('error', 'debug', 'Invalid JSON import file', error)
      showToast(t('toast_import_failed', lang))
    } finally {
      setPending(false)
      event.target.value = ''
      await refreshLogs()
    }
  }, [lang, onRefresh, refreshLogs, showToast])

  // ── Redirect CRUD (persisted) ─────────────────────────────────────────────
  const addRedirect = () => {
    const draft = { id: Date.now(), name: '', from: '', to: 'http://localhost:3000', enabled: false, hits: 0 }
    setRedirects(prev => [...prev, draft])
    setEditor({ kind: 'redirect', id: draft.id, isNew: true })
  }
  const saveRedirect = async (next) => {
    if (pending) return
    setPending(true)
    const res = editor?.isNew ? await addRedirectConfig(next) : await updateRedirectConfig(next.id, next)
    setPending(false)
    if (!res.ok) { showToast(errorText(res.error)); return }
    setRedirects(res.data)
    await removeDraft('redirect', next.id)
    setEditor(null)
    pushDebugLog('info', 'redirect', `Saved redirect: ${next.name} (${next.from} → ${next.to})`)
    showToast(t('toast_saved', lang))
    refreshLogs()
    onRefresh?.(['redirect'])
  }
  const deleteRedirect = async (id) => {
    if (pending) return
    setPending(true)
    const res = await deleteRedirectConfig(id)
    setPending(false)
    if (!res.ok) { showToast(errorText(res.error)); return }
    setRedirects(res.data)
    await removeDraft('redirect', id)
    // Only close editor if it was editing the specific deleted rule
    if (editor?.id === id) setEditor(null)
    pushDebugLog('warn', 'redirect', `Deleted redirect id=${id}`)
    showToast(t('toast_deleted', lang))
    refreshLogs()
    onRefresh?.(['redirect'])
  }
  const toggleRedirect = async (id, enabled) => {
    if (pending) return
    setPending(true)
    const res = await toggleRedirectEnabled(id, enabled)
    setPending(false)
    if (!res.ok) { showToast(errorText(res.error)); return }
    setRedirects(res.data)
    pushDebugLog('info', 'redirect', `Toggled redirect id=${id} → ${enabled ? 'enabled' : 'disabled'}`)
    refreshLogs()
    onRefresh?.(['redirect'])
  }

  // ── Intercept CRUD (persisted) ────────────────────────────────────────────
  const addIntercept = () => {
    const draft = { id: Date.now(), name: '', method: 'GET', pattern: '', status: 200, body: '{}', enabled: false }
    setIntercepts(prev => [...prev, draft])
    setEditor({ kind: 'intercept', id: draft.id, isNew: true })
  }
  const saveIntercept = async (next) => {
    if (pending) return
    setPending(true)
    const res = editor?.isNew ? await addInterceptConfig(next) : await updateInterceptConfig(next.id, next)
    setPending(false)
    if (!res.ok) { showToast(errorText(res.error)); return }
    setIntercepts(res.data)
    await removeDraft('intercept', next.id)
    setEditor(null)
    pushDebugLog('info', 'intercept', `Saved intercept: ${next.name}`)
    showToast(t('toast_saved', lang))
    refreshLogs()
    onRefresh?.(['intercept'])
  }
  const deleteIntercept = async (id) => {
    if (pending) return
    setPending(true)
    const res = await deleteInterceptConfig(id)
    setPending(false)
    if (!res.ok) { showToast(errorText(res.error)); return }
    setIntercepts(res.data)
    await removeDraft('intercept', id)
    if (editor?.kind === 'intercept' && editor?.id === id) setEditor(null)
    pushDebugLog('warn', 'intercept', `Deleted intercept id=${id}`)
    showToast(t('toast_deleted', lang))
    refreshLogs()
    onRefresh?.(['intercept'])
  }
  const toggleIntercept = async (id, enabled) => {
    if (pending) return
    setPending(true)
    const res = await toggleInterceptEnabled(id, enabled)
    setPending(false)
    if (!res.ok) { showToast(errorText(res.error)); return }
    setIntercepts(res.data)
    pushDebugLog('info', 'intercept', `Toggled intercept id=${id} → ${enabled ? 'enabled' : 'disabled'}`)
    refreshLogs()
    onRefresh?.(['intercept'])
  }

  const pauseAllRules = () => updateSystemOn(false)
  const resumeRules = () => updateSystemOn(true)

  // ── Session CRUD (runtime-managed) ─────────────────────────────────────────
  const refreshSessions = useCallback(async () => {
    const refreshed = await getIsolatedTabs()
    if (refreshed.ok) {
      setSessions(mergeSessions(refreshed.data?.isolatedTabs || [], sessionPresets))
    }
    return refreshed
  }, [sessionPresets])

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
    if (pending) return
    if (next.isolationId) {
      setPending(true)
      const result = await renameIsolatedTab(next.isolationId || next.id, next.name)
      setPending(false)
      if (!result.ok) { showToast(errorText(result.error)); return }
      pushDebugLog('info', 'session', `Renamed isolated session: ${next.name}`)
      await refreshSessions()
      await refreshLogs()
      onRefresh?.(['session', 'debug'])
    } else {
      setPending(true)
      const result = await saveSessionPreset({ ...next, isDraft: false })
      setPending(false)
      if (!result.ok) { showToast(errorText(result.error)); return }
      const saved = { ...next, isDraft: false, isPreset: true }
      setSessionPresets(prev => [...prev.filter(item => item.id !== saved.id), saved])
      setSessions(prev => prev.map(s => s.id === next.id ? saved : s))
    }
    await removeDraft('session', next.id)
    showToast(t('toast_saved', lang))
    setEditor(null)
  }
  const deleteSession = async (id) => {
    if (pending) return
    const session = sessions.find(s => s.id === id)
    if (session?.isolationId) {
      setPending(true)
      const result = await removeIsolatedTab(session.isolationId || id)
      setPending(false)
      if (!result.ok) { showToast(errorText(result.error)); return }
      pushDebugLog('warn', 'session', `Deleted isolated session: ${session.name}`)
      await refreshSessions()
      await refreshLogs()
      onRefresh?.(['session', 'debug'])
    } else {
      setPending(true)
      const result = await removeSessionPreset(id)
      setPending(false)
      if (!result.ok) { showToast(errorText(result.error)); return }
      setSessionPresets(prev => prev.filter(item => item.id !== id))
      setSessions(prev => prev.filter(s => s.id !== id))
    }
    await removeDraft('session', id)
    showToast(t('toast_deleted', lang))
    if (editor?.kind === 'session' && editor?.id === id) setEditor(null)
  }
  const launchSession = async (id) => {
    if (pending) return
    const session = sessions.find(s => s.id === id)
    if (!session) return

    if (session.isolationId) {
      setPending(true)
      const result = await activateIsolatedTab(session.isolationId)
      setPending(false)
      if (!result.ok) { showToast(errorText(result.error)); return }
      pushDebugLog('info', 'session', `Activated isolated session: ${session.name}`)
    } else {
      const origin = validateSessionOrigin(session.origin || session.url)
      if (!origin.ok) { showToast(t('err_origin', lang)); return }
      setPending(true)
      const result = await createIsolatedTab(origin.value)
      setPending(false)
      if (!result.ok) { showToast(errorText(result.error)); return }
      pushDebugLog('info', 'session', `Created isolated session from ${origin.value}`)
    }

    await refreshSessions()
    await refreshLogs()
    onRefresh?.(['session', 'debug'])
  }
  const closeSession = async (id) => {
    const session = sessions.find(s => s.id === id)
    if (!session?.isolationId) return

    if (pending) return
    setPending(true)
    const result = await removeIsolatedTab(session.isolationId)
    setPending(false)
    if (!result.ok) { showToast(errorText(result.error)); return }
    pushDebugLog('warn', 'session', `Closed isolated session: ${session.name}`)
    await refreshSessions()
    await refreshLogs()
    onRefresh?.(['session', 'debug'])
  }

  const editingRedirect = editor?.kind === 'redirect' ? redirects.find(r => r.id === editor.id) : undefined
  const editingIntercept = editor?.kind === 'intercept' ? intercepts.find(r => r.id === editor.id) : undefined
  const editingSession = editor?.kind === 'session' ? sessions.find(s => s.id === editor.id) : undefined

  const resumeDraft = (draft) => {
    if (draft.kind === 'redirect') setRedirects(prev => prev.some(item => item.id === draft.id) ? prev.map(item => item.id === draft.id ? draft.values : item) : [...prev, draft.values])
    if (draft.kind === 'intercept') setIntercepts(prev => prev.some(item => item.id === draft.id) ? prev.map(item => item.id === draft.id ? draft.values : item) : [...prev, draft.values])
    if (draft.kind === 'session') setSessions(prev => prev.some(item => item.id === draft.id) ? prev.map(item => item.id === draft.id ? draft.values : item) : [...prev, draft.values])
    setEditor({ kind: draft.kind, id: draft.id, isNew: draft.isNew })
    setDraftRecovery(prev => prev.filter(item => !(item.kind === draft.kind && item.id === draft.id)))
  }

  const discardDraft = async (draft) => {
    await removeDraft(draft.kind, draft.id)
    setDraftRecovery(prev => prev.filter(item => !(item.kind === draft.kind && item.id === draft.id)))
    if (draft.isNew) {
      if (draft.kind === 'redirect') setRedirects(prev => prev.filter(item => item.id !== draft.id))
      if (draft.kind === 'intercept') setIntercepts(prev => prev.filter(item => item.id !== draft.id))
      if (draft.kind === 'session') setSessions(prev => prev.filter(item => item.id !== draft.id))
    }
  }

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
         {state?.updateAvailable && <a className="update-chip" href="https://github.com/zakyyudha/basuki/releases/latest" target="_blank" rel="noreferrer">{t('update_available', lang)}{state.latestVersion ? ` · ${state.latestVersion}` : ''}</a>}
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
             <button key={tb.key} id={`tab-${tb.key}`} role="tab" tabIndex={tab === tb.key ? 0 : -1} aria-controls={`panel-${tb.key}`} aria-selected={tab === tb.key}
             className={`popup-tabs__btn${tab === tb.key ? ' active' : ''}`}
             onClick={() => handleTabChange(tb.key)}
             onKeyDown={event => {
               if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
               event.preventDefault()
               const index = TABS.findIndex(item => item.key === tb.key)
               const next = TABS[(index + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length]
               handleTabChange(next.key)
               document.getElementById(`tab-${next.key}`)?.focus()
             }}>
             {t(tb.tKey, lang)}{tb.key !== 'debug' && <span className="tab-count">{tabCounts[tb.key]}</span>}
          </button>
        ))}
      </nav>

      <div className="popup-body" id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {draftRecovery.length > 0 && !editor && (
          <section className="draft-recovery" role="status">
            <strong>{t('draft_recovery_title', lang)}</strong>
            {draftRecovery.map(draft => (
              <div className="draft-recovery__item" key={`${draft.kind}:${draft.id}`}>
                <span>{t(`tab_${draft.kind}`, lang)} · {new Date(draft.updatedAt).toLocaleTimeString()}</span>
                <button className="btn-edit" onClick={() => resumeDraft(draft)}>{t('resume', lang)}</button>
                <button className="btn-delete" onClick={() => discardDraft(draft)}>{t('discard', lang)}</button>
              </div>
            ))}
          </section>
        )}
       {!loading && tab === 'redirect' && (
          <RedirectsPanel lang={lang} systemOn={systemOn} pending={pending} rules={redirects}
            onToggle={toggleRedirect} onAdd={addRedirect}
            onEdit={id => setEditor({ kind: 'redirect', id, isNew: false })}
            onDelete={deleteRedirect} />
        )}
        {loading && <><div className="skeleton-card" /><div className="skeleton-card" /><div className="skeleton-card" /></>}
        {!loading && tab === 'intercept' && (
          <InterceptsPanel lang={lang} systemOn={systemOn} pending={pending} rules={intercepts}
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
            logs={logs} traffic={traffic} onClearTraffic={handleClearTraffic} onOpenInspector={handleOpenInspector}
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
             onClose={() => { removeDraft('redirect', editingRedirect.id); if (editor.isNew) setRedirects(prev => prev.filter(r => r.id !== editingRedirect.id)); setEditor(null) }} />
        )}
        {editingIntercept && editor?.kind === 'intercept' && (
          <InterceptEditor lang={lang} rule={editingIntercept} isNew={editor.isNew}
            onSave={saveIntercept}
            onDelete={() => deleteIntercept(editingIntercept.id)}
             onClose={() => { removeDraft('intercept', editingIntercept.id); if (editor.isNew) setIntercepts(prev => prev.filter(r => r.id !== editingIntercept.id)); setEditor(null) }} />
        )}
        {editingSession && editor?.kind === 'session' && (
          <SessionEditor lang={lang} session={editingSession} isNew={editor.isNew}
            onSave={saveSession}
            onDelete={() => deleteSession(editingSession.id)}
             onClose={() => { removeDraft('session', editingSession.id); if (editor.isNew) setSessions(prev => prev.filter(s => s.id !== editingSession.id)); setEditor(null) }} />
        )}
       </div>
       <Toast message={toast} />

      <footer className="popup-footer">
        <div className="popup-footer__stats">
          <div className="popup-stat">
            <span className="popup-stat__label">{t('stat_rules', lang)}</span>
             <span className="popup-stat__value">{activeRules}/{redirects.length + intercepts.length}</span>
          </div>
          <div className="popup-stat">
            <span className="popup-stat__label">{t('stat_sessions', lang)}</span>
             <span className="popup-stat__value">{activeSessions}/{sessions.length}</span>
          </div>
          <div className="popup-stat">
            <span className="popup-stat__label">{t('stat_hits', lang)}</span>
            <span className="popup-stat__value accent">{totalHits.toLocaleString()}</span>
          </div>
        </div>
        <div className="popup-footer__actions">
           <button className={`btn-pause-all${systemOn ? '' : ' resume'}`} onClick={() => { if (systemOn) pauseAllRules(); else resumeRules() }} title={systemOn ? t('pause_all_title', lang) : t('resume_all_title', lang)}>
            <span className="btn-pause-all__dot" />
            {systemOn ? t('footer_quick_toggle', lang) : t('footer_quick_resume', lang)}
          </button>
        </div>
      </footer>
    </div>
  )
}
