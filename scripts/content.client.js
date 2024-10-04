function injectScript (src, config) {
  const s = document.createElement('script')
  s.src = chrome.runtime.getURL(src)
  s.type = 'module'
  s.onload = () => {
    s.remove()
    window.postMessage({ type: 'API_REDIRECTOR_CONFIG', config }, '*')
  };
  (document.head || document.documentElement).append(s)
}

chrome.storage.sync.get('configs', (data) => {
  const configs = data.configs || []
  console.log('Basuki - API Redirector Settings Loaded:', configs)

  const isAnyConfigEnabled = configs.some(config => config.enabled)

  if (!isAnyConfigEnabled) {
    console.log('Basuki - API Redirector is disabled.')
    return
  }

  console.log('Basuki - API Redirector is enabled.')

  injectScript('scripts/basuki.intercept.js', configs)
})
