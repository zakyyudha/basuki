import { ConfigManager, CONFIG_KIND, VALUE_IDS } from './modules/configManager.js'
import { validateRedirectForm, validateInterceptForm } from './utils/validation.js'
import { SessionIsolationManager } from './modules/sessionIsolationUI.js'
import { initTooltips, loadFooter } from './utils/ui.js'

function initWorkflowNavigation() {
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

// Initial setup
document.addEventListener('DOMContentLoaded', function () {
  initWorkflowNavigation()

  // Initialize Bootstrap Tooltips
  initTooltips()

  // Initialize Config Managers
  const apiRedirectManager = new ConfigManager(CONFIG_KIND.API_REDIRECT, VALUE_IDS.API_REDIRECT)
  apiRedirectManager.saveInput('save', validateRedirectForm)
  apiRedirectManager.loadConfigs()

  const apiInterceptManager = new ConfigManager(CONFIG_KIND.API_INTERCEPT, VALUE_IDS.API_INTERCEPT)
  apiInterceptManager.saveInput('intercept-save', validateInterceptForm)
  apiInterceptManager.loadConfigs()

  // Initialize Session Isolation Manager
  new SessionIsolationManager()

  // Load footer with version number
  loadFooter()

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
})
