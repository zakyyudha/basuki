import { useMemo, useState } from 'react'

import { LANGS, t } from '../i18n/dictionary.js'

const TABS = [
  { key: 'redirect', labelKey: 'tab_redirect', panelKey: 'panel_redirects' },
  { key: 'intercept', labelKey: 'tab_intercept', panelKey: 'panel_intercepts' },
  { key: 'session', labelKey: 'tab_session', panelKey: 'panel_sessions' },
  { key: 'debug', labelKey: 'tab_debug', panelKey: 'panel_debug' },
]

function getStatusLabel(systemState, lang) {
  if (systemState === 'off') {
    return t('status_paused', lang)
  }

  if (systemState === 'intercepting') {
    return t('status_intercepting', lang)
  }

  return t('status_active', lang)
}

function fmtDate(value) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleTimeString()
}

export function AppShell({
  state,
  lang,
  onLanguageChange,
  onRefresh,
}) {
  const [activeTab, setActiveTab] = useState('redirect')

  const statusLabel = getStatusLabel(state.systemState, lang)

  const stats = useMemo(
    () => [
      {
        id: 'rules',
        label: t('stat_rules', lang),
        value: `${state.summary.activeRedirects + state.summary.activeIntercepts}`.padStart(2, '0'),
      },
      {
        id: 'sessions',
        label: t('stat_sessions', lang),
        value: `${state.summary.activeSessions}`.padStart(2, '0'),
      },
      {
        id: 'hits',
        label: t('stat_hits', lang),
        value: `${state.logs.length}`,
      },
    ],
    [lang, state.logs.length, state.summary.activeIntercepts, state.summary.activeRedirects, state.summary.activeSessions],
  )

  return (
    <div className="popup-shell" id="popupShell">
      <header className="popup-header">
        <div className="popup-brand">
          <div className="popup-brand__mark" aria-hidden="true">B</div>
          <div>
            <h1 className="popup-brand__title">{t('popup_title', lang)}</h1>
            <p className="popup-brand__subtitle">{t('popup_tagline', lang)}</p>
          </div>
        </div>

        <div className="popup-header__actions">
          <div className="runtime-pill" id="runtimeStatus" aria-live="polite">
            <span className="runtime-pill__dot" />
            <span>{t('shell_live_label', lang)}</span>
          </div>

          <div className="lang-switch" aria-label="language switch">
            {LANGS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`lang-switch__btn${item.key === lang ? ' is-active' : ''}`}
                onClick={() => onLanguageChange(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="popup-summary" aria-live="polite">
        <article className="summary-card is-accent">
          <span className="summary-card__label">{statusLabel}</span>
          <p className="summary-card__value">{t('popup_version', lang)}</p>
        </article>
        <article className="summary-card">
          <span className="summary-card__label">{t('debug_storage_mode', lang)}</span>
          <p className="summary-card__value">{state.summary.storageMode}</p>
        </article>
        <article className="summary-card">
          <span className="summary-card__label">{t('debug_last_sync', lang)}</span>
          <p className="summary-card__value">{fmtDate(state.hydrationMeta.loadedAt)}</p>
        </article>
      </section>

      <nav className="popup-tabs" role="tablist" aria-label="Basuki workflow tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`tab-${tab.key}`}
            aria-selected={activeTab === tab.key}
            aria-controls={`panel-${tab.key}`}
            className={`popup-tab${activeTab === tab.key ? ' is-active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {t(tab.labelKey, lang)}
          </button>
        ))}
      </nav>

      <section className="popup-panels">
        {TABS.map((tab) => (
          <article
            key={tab.key}
            id={`panel-${tab.key}`}
            role="tabpanel"
            aria-labelledby={`tab-${tab.key}`}
            hidden={activeTab !== tab.key}
            className="panel-card"
          >
            <header className="panel-card__header">
              <h2>{t(tab.panelKey, lang)}</h2>
              <button type="button" className="ghost-btn" onClick={() => onRefresh([tab.key, 'debug'])}>
                {t('shell_refresh', lang)}
              </button>
            </header>

            {state.loading ? (
              <p className="panel-card__empty">{t('shell_loading', lang)}</p>
            ) : (
              <PanelBody tab={tab.key} lang={lang} state={state} />
            )}
          </article>
        ))}
      </section>

      <footer className="popup-footer">
        <div className="popup-stats">
          {stats.map((stat) => (
            <article key={stat.id} className="popup-stat">
              <span className="popup-stat__label">{stat.label}</span>
              <span className="popup-stat__value">{stat.value}</span>
            </article>
          ))}
        </div>
      </footer>
    </div>
  )
}

function PanelBody({ tab, lang, state }) {
  if (tab === 'redirect') {
    if (state.redirects.length === 0) {
      return <p className="panel-card__empty">{t('shell_empty', lang)}</p>
    }

    return (
      <ul className="panel-list">
        {state.redirects.slice(0, 8).map((item) => (
          <li key={item.id}>
            <span>{item.configName || `Redirect ${item.id}`}</span>
            <small>{item.enabled ? 'ON' : 'OFF'}</small>
          </li>
        ))}
      </ul>
    )
  }

  if (tab === 'intercept') {
    if (state.intercepts.length === 0) {
      return <p className="panel-card__empty">{t('shell_empty', lang)}</p>
    }

    return (
      <ul className="panel-list">
        {state.intercepts.slice(0, 8).map((item) => (
          <li key={item.id}>
            <span>{item.interceptConfigName || `Intercept ${item.id}`}</span>
            <small>{item.enabled ? 'ON' : 'OFF'}</small>
          </li>
        ))}
      </ul>
    )
  }

  if (tab === 'session') {
    if (state.sessions.length === 0) {
      return <p className="panel-card__empty">{t('shell_empty', lang)}</p>
    }

    return (
      <ul className="panel-list">
        {state.sessions.slice(0, 8).map((item) => (
          <li key={item.id}>
            <span>{item.name || `Session ${item.id}`}</span>
            <small>{item.active ? 'ACTIVE' : 'IDLE'}</small>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <dl className="debug-kv">
      <div>
        <dt>{t('debug_log_count', lang)}</dt>
        <dd>{state.logs.length}</dd>
      </div>
      <div>
        <dt>{t('debug_storage_mode', lang)}</dt>
        <dd>{state.summary.storageMode}</dd>
      </div>
      <div>
        <dt>{t('debug_last_sync', lang)}</dt>
        <dd>{fmtDate(state.hydrationMeta.loadedAt)}</dd>
      </div>
    </dl>
  )
}
