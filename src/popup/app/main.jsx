import React from 'react'
import { createRoot } from 'react-dom/client'

import { pushDebugLog } from '../adapters/debugAdapter.js'
import { AppShell } from './AppShell.jsx'
import { BootstrapBoundary } from './BootstrapBoundary.jsx'
import { renderBootstrapFallback } from './bootstrapFallback.js'
import { createPopupStore } from './store.js'
import { t } from '../i18n/dictionary.js'
import { getStoredLanguage, setStoredLanguage } from '../i18n/languageStore.js'
import '../styles/index.css'

const rootElement = document.getElementById('popupRoot')

function renderBoundaryFallback(lang) {
  return (
    <section className="popup-fallback" role="alert" aria-live="assertive">
      <div className="popup-fallback__badge">Basuki</div>
      <h1 className="popup-fallback__title">{t('bootstrap_failed_title', lang)}</h1>
      <p className="popup-fallback__message">{t('bootstrap_failed_message', lang)}</p>
    </section>
  )
}

async function bootstrap() {
  if (!rootElement) {
    return
  }

  const langState = {
    value: getStoredLanguage(),
  }

  const store = createPopupStore({
    onDebug: (error) => {
      pushDebugLog('error', 'bootstrap', 'Store debug event', error)
    },
  })

  try {
    await store.initialize()

    const root = createRoot(rootElement)

    function App() {
      const [snapshot, setSnapshot] = React.useState(store.getState())
      const [lang, setLang] = React.useState(langState.value)

      React.useEffect(() => {
        const unsubscribe = store.subscribe(setSnapshot)
        return () => {
          unsubscribe()
          store.dispose()
        }
      }, [])

      return (
        <BootstrapBoundary
          onError={({ error, info }) => {
            pushDebugLog('error', 'bootstrap', 'Render boundary failure', {
              phase: 'render',
              message: error?.message,
              stack: error?.stack,
              info,
            })
          }}
          renderFallback={() => renderBoundaryFallback(lang)}
        >
          <AppShell
            state={snapshot}
            lang={lang}
            onLanguageChange={(value) => {
              const next = setStoredLanguage(value)
              langState.value = next
              setLang(next)
            }}
            onRefresh={(domains) => store.refresh(domains)}
          />
        </BootstrapBoundary>
      )
    }

    root.render(<App />)
  } catch (error) {
    pushDebugLog('error', 'bootstrap', 'Failed to initialize popup shell', {
      phase: 'startup',
      message: error?.message,
      stack: error?.stack,
    })

    renderBootstrapFallback(rootElement, {
      title: t('bootstrap_failed_title', langState.value),
      message: 'Failed to initialize popup. Please reopen or reload extension.',
    })
  }
}

bootstrap()
