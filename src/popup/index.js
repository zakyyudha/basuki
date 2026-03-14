import { ConfigManager, CONFIG_KIND, VALUE_IDS } from './modules/configManager.js'
import { validateRedirectForm, validateInterceptForm } from './utils/validation.js'
import { SessionIsolationManager } from './modules/sessionIsolationUI.js'
import { initTooltips, loadFooter, applyFrameSafeLayout } from './utils/ui.js'
import { createFeedbackController } from './utils/feedback.js'
import { getStorageData } from './utils/storage.js'

function initWorkflowNavigation(onWorkflowChange) {
  const nav = document.getElementById('workflowNav')
  const content = document.getElementById('workflowContent')

  if (!nav || !content) {
    return
  }

  const tabs = Array.from(nav.querySelectorAll('[data-workflow-target]'))
  const panels = Array.from(content.querySelectorAll('.workflow-panel'))

  const setActiveWorkflow = (targetId) => {
    tabs.forEach((tab) => {
      const isActive = tab.dataset.workflowTarget === targetId
      tab.classList.toggle('active', isActive)
      tab.setAttribute('aria-selected', String(isActive))
    })

    panels.forEach((panel) => {
      const isActive = panel.id === targetId
      panel.classList.toggle('active', isActive)
      panel.classList.toggle('show', isActive)
      if (!isActive) {
        panel.classList.add('fade')
      }
    })
    onWorkflowChange?.(targetId)
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.workflowTarget
      if (targetId) {
        setActiveWorkflow(targetId)
      }
    })
  })

  const initialTab = tabs.find((tab) => tab.classList.contains('active')) ?? tabs[0]
  if (initialTab?.dataset.workflowTarget) {
    setActiveWorkflow(initialTab.dataset.workflowTarget)
  }
}

async function loadActiveWorkflowSummary () {
  const redirectNode = document.getElementById('summaryRedirectCount')
  const interceptNode = document.getElementById('summaryInterceptCount')
  const sessionNode = document.getElementById('summarySessionState')

  if (!redirectNode || !interceptNode || !sessionNode) {
    return
  }

  const [storage, sessionResponse] = await Promise.all([
    getStorageData(['apiRedirect', 'apiIntercept']),
    new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getIsolatedTabs' }, (response) => {
        resolve(response || {})
      })
    }),
  ])

  const activeRedirects = (storage.apiRedirect?.configs || []).filter(config => config.enabled).length
  const activeIntercepts = (storage.apiIntercept?.configs || []).filter(config => config.enabled).length
  const isolatedTabs = sessionResponse.isolatedTabs || []
  const activeSessions = isolatedTabs.filter(tab => tab.active).length

  redirectNode.textContent = String(activeRedirects)
  interceptNode.textContent = String(activeIntercepts)
  sessionNode.textContent = activeSessions > 0
    ? `${activeSessions} aktif dari ${isolatedTabs.length}`
    : (isolatedTabs.length > 0 ? `${isolatedTabs.length} sesi tidak aktif` : 'Tidak ada sesi aktif')
}

// Initial setup
document.addEventListener('DOMContentLoaded', function () {
  applyFrameSafeLayout()
  const feedback = createFeedbackController()
  const refreshSummary = () => {
    loadActiveWorkflowSummary().catch((error) => {
      console.error('Basuki - Failed to load summary:', error)
      feedback.show('Gagal memuat ringkasan status aktif', 'error')
    })
  }

  initWorkflowNavigation(() => {
    refreshSummary()
  })

  // Initialize Bootstrap Tooltips
  initTooltips()

  // Initialize Config Managers
  const apiRedirectManager = new ConfigManager(CONFIG_KIND.API_REDIRECT, VALUE_IDS.API_REDIRECT, {
    feedback,
    onStateChanged: refreshSummary,
  })
  apiRedirectManager.saveInput('save', validateRedirectForm)
  apiRedirectManager.loadConfigs()

  const apiInterceptManager = new ConfigManager(CONFIG_KIND.API_INTERCEPT, VALUE_IDS.API_INTERCEPT, {
    feedback,
    onStateChanged: refreshSummary,
  })
  apiInterceptManager.saveInput('intercept-save', validateInterceptForm)
  apiInterceptManager.loadConfigs()

  // Initialize Session Isolation Manager
  new SessionIsolationManager({
    feedback,
    onStateChanged: refreshSummary,
  })

  // Load footer with version number
  loadFooter()
  refreshSummary()

  // Event listener for JSON formatting in interceptResponseBody
  document.getElementById('interceptResponseBody').addEventListener('input', function () {
    const textArea = document.getElementById('interceptResponseBody')
    const json = textArea.value
    try {
      const parsed = JSON.parse(json)
      textArea.classList.remove('is-invalid')
      textArea.value = JSON.stringify(parsed, null, 2)
    } catch {
      textArea.classList.add('is-invalid')
    }
  })

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'local') {
      return
    }
    if (changes.apiRedirect || changes.apiIntercept || changes.sessionIsolation) {
      refreshSummary()
    }
  })

  window.addEventListener('resize', applyFrameSafeLayout)
})
