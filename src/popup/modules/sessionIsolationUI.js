import { getStorageData } from '../../background/utils/storage.js'
import { copyFrom } from '../utils/copy.js'

export class SessionIsolationManager {
  constructor(options = {}) {
    this.feedback = options.feedback
    this.onStateChanged = options.onStateChanged
    this.initEventListeners()
    this.loadIsolatedTabs()
    this.initUpdateListener()
  }

  initEventListeners() {
    // Create new isolated tab
    document.getElementById('createIsolatedTab').addEventListener('click', () => {
      const urlInput = document.getElementById('newIsolationUrl')
      const url = urlInput.value.trim()
      
      if (!url) {
        this.feedback?.show(copyFrom('sessions.enterValidUrl'), 'error')
        return
      }
      
      // Validate URL
      try {
        new URL(url)
      } catch (e) {
        this.feedback?.show(copyFrom('sessions.invalidUrlFormat'), 'error')
        return
      }
      
      chrome.runtime.sendMessage(
        { action: 'createIsolatedTab', url },
        (response) => {
          if (response.success) {
            urlInput.value = ''
            this.feedback?.show(copyFrom('sessions.created'), 'success')
            // Reload after a short delay to allow the tab to be created
            setTimeout(async () => {
              await this.loadIsolatedTabs()
              this.onStateChanged?.()
            }, 500)
          } else {
            this.feedback?.show(copyFrom('sessions.createFailed'), 'error')
          }
        }
      )
    })
    
    // Clear all session isolation
    document.getElementById('isolation-clearSessionIsolation').addEventListener('click', () => {
      if (confirm(copyFrom('confirmations.clearSessions'))) {
        // Send message to background script to handle closing tabs and clearing storage
        chrome.runtime.sendMessage(
          { action: 'clearAllIsolatedSessions' },
          (response) => {
            if (response.success) {
              this.feedback?.show(copyFrom('sessions.cleared'), 'info')
              this.loadIsolatedTabs() // Refresh the list
              this.onStateChanged?.()
            } else {
              this.feedback?.show(copyFrom('sessions.clearFailed'), 'error')
            }
          }
        )
      }
    })
    
    // Save session name in modal
    document.getElementById('saveSessionName').addEventListener('click', () => {
      const sessionId = parseInt(document.getElementById('renameSessionId').value)
      const newName = document.getElementById('sessionName').value.trim()
      
      if (!newName) {
        this.feedback?.show(copyFrom('sessions.emptyName'), 'error')
        return
      }
      
      chrome.runtime.sendMessage(
        { action: 'renameIsolatedTab', isolationId: sessionId, newName },
        (response) => {
          if (response.success) {
            // Close modal and reload tabs
            const modal = bootstrap.Modal.getInstance(document.getElementById('renameSessionModal'))
            modal.hide()
            this.loadIsolatedTabs()
            this.onStateChanged?.()
            this.feedback?.show(copyFrom('sessions.renamed'), 'success')
          } else {
            this.feedback?.show(copyFrom('sessions.renameFailed'), 'error')
          }
        }
      )
    })
  }

  initUpdateListener() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.sessionIsolation) {
        this.loadIsolatedTabs()
      }
    })
  }
  
  loadIsolatedTabs() {
    chrome.runtime.sendMessage({ action: 'getIsolatedTabs' }, (response) => {
      const isolatedTabs = response?.isolatedTabs || []
      const tableBody = document.getElementById('isolatedTabsList')
      const noTabsMessage = document.getElementById('noIsolatedTabs')
      const table = document.getElementById('isolatedTabsTable')
      
      // Clear current list
      tableBody.innerHTML = ''
      
      if (isolatedTabs.length === 0) {
        noTabsMessage.textContent = copyFrom('sessions.emptyState')
        noTabsMessage.style.display = 'block'
        table.style.display = 'none'
        return
      }
      
      // Sort tabs with active ones first
      const sortedTabs = [...isolatedTabs].sort((a, b) => {
        if (a.active && !b.active) return -1
        if (!a.active && b.active) return 1
        return 0
      })
      
      noTabsMessage.style.display = 'none'
      table.style.display = 'table'
      
      sortedTabs.forEach(tab => {
        const row = document.createElement('tr')
        row.className = 'workflow-row'
        
        // Name cell
        const nameCell = document.createElement('td')
        nameCell.textContent = tab.name
        row.appendChild(nameCell)
        
        // Host cell
        const hostCell = document.createElement('td')
        hostCell.textContent = tab.host
        row.appendChild(hostCell)
        
        // Status cell
        const statusCell = document.createElement('td')
        const statusBadge = document.createElement('span')
        statusBadge.className = tab.active
          ? 'status-badge status-badge--active'
          : 'status-badge status-badge--inactive'
        statusBadge.textContent = tab.active
          ? copyFrom('status.active')
          : copyFrom('status.inactive')
        statusCell.appendChild(statusBadge)
        row.appendChild(statusCell)
        
        // Actions cell
        const actionsCell = document.createElement('td')
        const actionsWrapper = document.createElement('div')
        actionsWrapper.className = 'row-actions'
        
        // Go to tab button for active tabs
        if (tab.active) {
          const goToTabBtn = document.createElement('button')
          goToTabBtn.className = 'btn btn-sm action-btn action-btn--success'
          goToTabBtn.textContent = copyFrom('actions.openTab')
          goToTabBtn.addEventListener('click', () => {
            chrome.tabs.update(tab.tabId, { active: true }, () => {
              window.close() // Close the popup after navigating
            })
          })
          actionsWrapper.appendChild(goToTabBtn)
        }
        
        // Activate button
        if (!tab.active) {
          const activateBtn = document.createElement('button')
          activateBtn.className = 'btn btn-sm action-btn action-btn--primary'
          activateBtn.textContent = copyFrom('actions.activate')
          activateBtn.addEventListener('click', () => this.activateIsolatedTab(tab.id))
          actionsWrapper.appendChild(activateBtn)
        }
        
        // Rename button
        const renameBtn = document.createElement('button')
        renameBtn.className = 'btn btn-sm action-btn action-btn--neutral'
        renameBtn.textContent = copyFrom('actions.rename')
        renameBtn.addEventListener('click', () => this.showRenameModal(tab))
        actionsWrapper.appendChild(renameBtn)
        
        // Delete button
        const deleteBtn = document.createElement('button')
        deleteBtn.className = 'btn btn-sm action-btn action-btn--danger'
        deleteBtn.textContent = copyFrom('actions.delete')
        deleteBtn.addEventListener('click', () => this.removeIsolatedTab(tab.id))
        actionsWrapper.appendChild(deleteBtn)
        
        actionsCell.appendChild(actionsWrapper)
        row.appendChild(actionsCell)
        tableBody.appendChild(row)
      })
    })
  }
  
  activateIsolatedTab(isolationId) {
    chrome.runtime.sendMessage(
      { action: 'activateIsolatedTab', isolationId },
      (response) => {
        if (response.success) {
          window.close() // Close the popup as the tab is now active
        } else {
          this.feedback?.show(copyFrom('sessions.activateFailed'), 'error')
          this.loadIsolatedTabs() // Refresh the list
        }
      }
    )
  }
  
  showRenameModal(tab) {
    const modal = new bootstrap.Modal(document.getElementById('renameSessionModal'))
    document.getElementById('renameSessionId').value = tab.id
    document.getElementById('sessionName').value = tab.name
    modal.show()
  }
  
  removeIsolatedTab(isolationId) {
    if (confirm(copyFrom('confirmations.deleteSession'))) {
      chrome.runtime.sendMessage(
        { action: 'removeIsolatedTab', isolationId },
        (response) => {
          if (response.success) {
            this.loadIsolatedTabs()
            this.onStateChanged?.()
            this.feedback?.show(copyFrom('sessions.deleted'), 'info')
          } else {
            this.feedback?.show(copyFrom('sessions.deleteFailed'), 'error')
          }
        }
      )
    }
  }
}
