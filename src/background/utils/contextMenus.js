import { startIsolation } from '../modules/sessionIsolation.js'

export function createContextMenus() {
    // Remove all existing context menus first to avoid duplicates
    chrome.contextMenus.removeAll(() => {
        if (chrome.runtime.lastError) {
            console.error('Error removing context menus:', chrome.runtime.lastError.message)
        }

        // Create parent menu
        chrome.contextMenus.create({
            id: 'basukiSessionIsolation',
            title: 'Basuki - Isolasi Sesi',
            contexts: ['page'],
        })

        // Create child menu
        chrome.contextMenus.create({
            id: 'startIsolation',
            title: 'Buka Tab Terisolasi',
            parentId: 'basukiSessionIsolation',
            contexts: ['page'],
        })

        // Set up click listener
        chrome.contextMenus.onClicked.addListener((info, tab) => {
            if (info.menuItemId === 'startIsolation' && tab.url && tab.id) {
                startIsolation(tab.url, tab.id)
            }
        })
    })
}
