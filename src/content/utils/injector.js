
// src/content/utils/injector.js
export function injectScript (src) {
    const s = document.createElement('script')
    s.src = chrome.runtime.getURL(src)
    s.type = 'module'
    s.onload = () => {
      s.remove()
    }
    ;(document.head || document.documentElement).append(s)
  }

