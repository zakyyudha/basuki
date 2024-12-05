function injectScript (src, config) {
  const s = document.createElement('script')
  s.src = chrome.runtime.getURL(src)
  s.type = 'module'
  s.onload = () => {
    s.remove()
    window.postMessage({ type: 'BASUKI_CONFIG', config }, '*')
  };
  (document.head || document.documentElement).append(s)
}

chrome.storage.local.get((data) => {
  const anyEnabled = data.apiRedirect.configs.some(
      config => config.enabled) ||
    data.apiIntercept.configs.some(config => config.enabled)

  console.log('Basuki - Settings Loaded:', data)

  if (!anyEnabled) {
    console.log('Basuki - Disabled because no configs are enabled.')
    return
  }

  console.log('Basuki - Injecting content script.')
  injectScript('scripts/basuki.intercept.js', data)
})
