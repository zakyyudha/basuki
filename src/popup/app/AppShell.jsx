import React, { useState, useCallback } from 'react'
import { t } from '../i18n/dictionary.js'
import { getStoredLanguage, setStoredLanguage } from '../i18n/languageStore.js'

const LANGS = [{ key: 'en', label: 'EN' }, { key: 'id', label: 'ID' }]
const TABS = [
  { key: 'redirect', tKey: 'tab_redirect' },
  { key: 'intercept', tKey: 'tab_intercept' },
  { key: 'session', tKey: 'tab_session' },
  { key: 'debug', tKey: 'tab_debug' },
]

/* ── Toggle atom ──────────────────────────────────────────────────────────── */
function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`toggle${checked ? ' on' : ''}`}
    >
      <span className="toggle__dot" />
    </button>
  )
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

/* ── Status icon (SVG lightning bolt — matches rework icon shape) ─────────── */
function StatusIconSvg({ state }) {
  const colors = {
    off:          { bg: '#2a2a35', bolt: '#4b4b60' },
    on:           { bg: '#1a2e3a', bolt: '#22d3ee' },
    intercepting: { bg: '#1a2e3a', bolt: '#22d3ee' },
  }
  const { bg, bolt } = colors[state] || colors.on
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect width="22" height="22" rx="5" fill={bg} />
      <path
        d="M13 3L7 12h5l-1 7 8-10h-5l1-6z"
        fill={bolt}
        stroke={bolt}
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ── Panel shell ──────────────────────────────────────────────────────────── */
function PanelShell({ label, counter, onAdd, addLabel, children }) {
  return (
    <div className="panel-shell">
      <div className="panel-shell__head">
        <span className="panel-shell__label">{label}</span>
        <span className="panel-shell__counter">{counter}</span>
      </div>
      <div className="panel-shell__body">
        {children}
        <button className="btn-add-rule" onClick={onAdd}>{addLabel}</button>
      </div>
    </div>
  )
}

/* ── Redirect panel ───────────────────────────────────────────────────────── */
function RedirectsPanel({ lang, rules, onToggle, onAdd }) {
  const active = rules.filter(r => r.enabled).length
  const counter = `${String(active).padStart(2,'0')}/${String(rules.length).padStart(2,'0')}`
  return (
    <PanelShell
      label={t('panel_redirects', lang)}
      counter={counter}
      onAdd={onAdd}
      addLabel={t('add_rule', lang)}
    >
      {rules.length === 0 && (
        <button className="empty-state" onClick={onAdd}>{t('add_rule', lang)}</button>
      )}
      {rules.map(r => (
        <article key={r.id} className="rule-card">
          <div className="rule-card__head">
            <div>
              <div className="rule-card__name">{r.name}</div>
              <div className="rule-card__hits">
                Hits · <span>{(r.hits || 0).toLocaleString()}</span>
              </div>
            </div>
            <Toggle checked={r.enabled} onChange={() => onToggle(r.id)} label={`Toggle ${r.name}`} />
          </div>
          <KvRow k="FROM" v={r.from} />
          <KvRow k="TO" v={r.to} accent={r.enabled} />
          <div className="rule-card__actions">
            <button className="btn-edit">{t('edit', lang)}</button>
            <button className="btn-delete">{t('delete', lang)}</button>
          </div>
        </article>
      ))}
    </PanelShell>
  )
}

/* ── Intercept panel ──────────────────────────────────────────────────────── */
function InterceptsPanel({ lang, rules, onToggle, onAdd }) {
  const active = rules.filter(r => r.enabled).length
  const counter = `${String(active).padStart(2,'0')}/${String(rules.length).padStart(2,'0')}`
  return (
    <PanelShell
      label={t('panel_intercepts', lang)}
      counter={counter}
      onAdd={onAdd}
      addLabel={t('add_mock', lang)}
    >
      {rules.length === 0 && (
        <button className="empty-state" onClick={onAdd}>{t('add_mock', lang)}</button>
      )}
      {rules.map(r => (
        <article key={r.id} className="rule-card">
          <div className="rule-card__head">
            <div>
              <div className="rule-card__name">{r.name}</div>
              <div className="rule-card__hits" style={{color:'var(--muted)'}}>
                {r.method} · <span style={{color:'oklch(0.7 0.01 270)'}}>{r.pattern}</span>
              </div>
            </div>
            <Toggle checked={r.enabled} onChange={() => onToggle(r.id)} label={`Toggle ${r.name}`} />
          </div>
          <div className="rule-card__actions">
            <button className="btn-edit">{t('edit', lang)}</button>
            <button className="btn-delete">{t('delete', lang)}</button>
          </div>
        </article>
      ))}
    </PanelShell>
  )
}

/* ── Session panel ────────────────────────────────────────────────────────── */
function SessionsPanel({ lang, sessions, onLaunch, onClose, onAdd }) {
  const active = sessions.filter(s => s.active).length
  const counter = `${String(active).padStart(2,'0')}/${String(sessions.length).padStart(2,'0')}`
  return (
    <PanelShell
      label={t('panel_sessions', lang)}
      counter={counter}
      onAdd={onAdd}
      addLabel={t('add_session', lang)}
    >
      {sessions.length === 0 && (
        <button className="empty-state" onClick={onAdd}>{t('add_session', lang)}</button>
      )}
      {sessions.map(s => (
        <article key={s.id} className="rule-card" style={s.active ? {borderColor:'oklch(0.82 0.15 210 / 0.3)', boxShadow:'0 0 24px -8px var(--backlight)'} : {}}>
          <div className="rule-card__head">
            <div>
              <div className="rule-card__name">{s.name}</div>
              <code style={{fontSize:'10px',color:'var(--muted)',fontFamily:'var(--font-mono)'}}>{s.origin}</code>
            </div>
            <span style={{fontSize:'9px',fontFamily:'var(--font-mono)',letterSpacing:'0.1em',textTransform:'uppercase',color: s.active ? 'var(--backlight)' : 'oklch(0.4 0.01 270)'}}>
              <span style={{display:'inline-block',width:6,height:6,borderRadius:'9999px',background: s.active ? 'var(--backlight)' : 'oklch(0.3 0.01 270)',marginRight:4,verticalAlign:'middle'}} />
              {s.active ? t('status_active', lang) : 'Idle'}
            </span>
          </div>
          <div className="rule-card__actions">
            {s.active
              ? <button className="btn-edit" onClick={() => onClose(s.id)} style={{flex:1}}>{t('close', lang)}</button>
              : <button className="btn-edit" onClick={() => onLaunch(s.id)} style={{flex:1,background:'oklch(0.82 0.15 210 / 0.9)',color:'var(--obsidian)',borderColor:'transparent'}}>{t('launch', lang)}</button>
            }
            <button className="btn-edit">{t('edit', lang)}</button>
            <button className="btn-delete">{t('delete', lang)}</button>
          </div>
        </article>
      ))}
    </PanelShell>
  )
}

/* ── Debug panel ──────────────────────────────────────────────────────────── */
function SumRow({ k, v, accent, full }) {
  return (
    <div style={{
      gridColumn: full ? 'span 2' : undefined,
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      borderRadius: 6, border: '1px solid var(--hairline)',
      background: 'oklch(0.13 0.008 280 / 40%)',
      padding: '6px 8px',
    }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{k}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontVariantNumeric: 'tabular-nums', color: accent ? 'var(--backlight)' : 'oklch(0.85 0.005 270)' }}>{v}</span>
    </div>
  )
}

function DebugPanel({ lang, systemState, redirects, intercepts, sessions }) {
  const totals = {
    redirects: redirects.length,
    intercepts: intercepts.length,
    sessions: sessions.length,
    activeRedirects: redirects.filter(r => r.enabled).length,
    activeIntercepts: intercepts.filter(r => r.enabled).length,
    activeSessions: sessions.filter(s => s.active).length,
    hits: redirects.reduce((s, r) => s + (r.hits || 0), 0),
  }
  return (
    <div className="panel-shell">
      <div className="panel-shell__head">
        <span className="panel-shell__label">{t('panel_debug', lang)}</span>
        <span className="panel-shell__counter">000</span>
      </div>
      <div className="panel-shell__body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button className="debug-action-btn">↓ {t('debug_export', lang)}</button>
          <button className="debug-action-btn">↑ {t('debug_import', lang)}</button>
        </div>
        <section className="rule-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="panel-shell__label">{t('debug_summary', lang)}</span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: systemState === 'off' ? 'oklch(0.4 0.01 270)' : systemState === 'intercepting' ? 'var(--warn)' : 'var(--backlight)'
            }}>{systemState}</span>
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
            <button className="btn-delete" style={{ padding: '2px 8px' }}>{t('debug_clear', lang)}</button>
          </div>
          <div style={{ maxHeight: 160, overflowY: 'auto', padding: 8 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', textAlign: 'center', padding: '16px 0' }}>
              {t('debug_no_logs', lang)}
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}

/* ── Main AppShell ────────────────────────────────────────────────────────── */
export function AppShell({ state, store, onLanguageChange }) {
  const [lang, setLang] = useState(getStoredLanguage())
  const [tab, setTab] = useState('redirect')
  const [systemOn, setSystemOn] = useState(true)

  const redirects = state?.redirectConfigs || []
  const intercepts = state?.interceptConfigs || []
  const sessions = state?.isolatedTabs || []

  const activeRules = redirects.filter(r => r.enabled).length + intercepts.filter(r => r.enabled).length
  const activeSessions = sessions.filter(s => s.active).length
  const totalHits = redirects.reduce((sum, r) => sum + (r.hits || 0), 0)
  const systemState = !systemOn ? 'off' : activeRules > 0 ? 'intercepting' : 'on'

  const handleLang = useCallback((key) => {
    setLang(key)
    setStoredLanguage(key)
    onLanguageChange?.(key)
  }, [onLanguageChange])

  const handleToggleSystem = () => setSystemOn(v => !v)

  const handleToggleRedirect = (id) => {
    // wire to adapter in Phase 02
  }
  const handleToggleIntercept = (id) => {
    // wire to adapter in Phase 03
  }

  return (
    <div className="popup-root">
      {/* Header */}
      <header className="popup-header">
        <div className="popup-header__left">
          <button className="popup-icon-btn" onClick={handleToggleSystem} aria-label={t('toggle_system', lang)} title={t('toggle_system', lang)}>
            <StatusIconSvg state={systemState} />
          </button>
          <div className="popup-brand">
            <div className="popup-brand__name">
              BASUKI<span>v2.4.0</span>
            </div>
            <div className="popup-brand__status">
              {systemState === 'off' ? t('status_paused', lang) : systemState === 'intercepting' ? t('status_intercepting', lang) : t('status_active', lang)}
            </div>
          </div>
        </div>
        <div className="lang-switch">
          {LANGS.map(l => (
            <button key={l.key} className={`lang-switch__btn${lang === l.key ? ' active' : ''}`} onClick={() => handleLang(l.key)}>
              {l.label}
            </button>
          ))}
        </div>
      </header>

      {/* Tabs */}
      <nav className="popup-tabs" role="tablist">
        {TABS.map(tb => (
          <button
            key={tb.key}
            role="tab"
            aria-selected={tab === tb.key}
            className={`popup-tabs__btn${tab === tb.key ? ' active' : ''}`}
            onClick={() => setTab(tb.key)}
          >
            {t(tb.tKey, lang)}
          </button>
        ))}
      </nav>

      {/* Body */}
      <div className="popup-body" role="tabpanel">
        {tab === 'redirect' && (
          <RedirectsPanel lang={lang} rules={redirects} onToggle={handleToggleRedirect} onAdd={() => {}} />
        )}
        {tab === 'intercept' && (
          <InterceptsPanel lang={lang} rules={intercepts} onToggle={handleToggleIntercept} onAdd={() => {}} />
        )}
        {tab === 'session' && (
          <SessionsPanel lang={lang} sessions={sessions} onLaunch={() => {}} onClose={() => {}} onAdd={() => {}} />
        )}
        {tab === 'debug' && (
          <DebugPanel lang={lang} systemState={systemState} redirects={redirects} intercepts={intercepts} sessions={sessions} />
        )}
      </div>

      {/* Footer */}
      <footer className="popup-footer">
        <div className="popup-footer__stats">
          <div className="popup-stat">
            <span className="popup-stat__label">{t('stat_rules', lang)}</span>
            <span className="popup-stat__value">{String(activeRules).padStart(2,'0')}</span>
          </div>
          <div className="popup-stat">
            <span className="popup-stat__label">{t('stat_sessions', lang)}</span>
            <span className="popup-stat__value">{String(activeSessions).padStart(2,'0')}</span>
          </div>
          <div className="popup-stat">
            <span className="popup-stat__label">{t('stat_hits', lang)}</span>
            <span className="popup-stat__value accent">{totalHits.toLocaleString()}</span>
          </div>
        </div>
        <button
          className={`btn-pause-all${systemOn ? '' : ' resume'}`}
          onClick={handleToggleSystem}
        >
          <span className="btn-pause-all__dot" />
          {systemOn ? t('footer_quick_toggle', lang) : t('footer_quick_resume', lang)}
        </button>
      </footer>
    </div>
  )
}
