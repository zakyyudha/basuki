/* global bootstrap: false */
import { copyFrom } from './copy.js'

export function initTooltips () {
  const tooltipTriggerList = Array.from(
    document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.forEach(tooltipTriggerEl => {
    new bootstrap.Tooltip(tooltipTriggerEl)
  })
}

export function loadFooter () {
  applySharedCopy()

  const basukiVersion = chrome.runtime.getManifest().version
  document.querySelector('footer div span').innerHTML = `
      <a href="https://github.com/zakyyudha/basuki" target="_blank" style="text-decoration: none">
        <span class="text-body-secondary">&copy; Basuki (v${basukiVersion})</span>
      </a>
    `
}

function applySharedCopy () {
  document.querySelectorAll('[data-copy]').forEach((node) => {
    const key = node.getAttribute('data-copy')
    node.textContent = copyFrom(key, node.textContent)
  })

  document.querySelectorAll('[data-copy-placeholder]').forEach((node) => {
    const key = node.getAttribute('data-copy-placeholder')
    node.setAttribute('placeholder', copyFrom(key, node.getAttribute('placeholder') || ''))
  })
}
