window.addEventListener('message', (event) => {
  if (event.source !== window || event.data.type !== 'API_REDIRECTOR_CONFIG') {
    return
  }

  const configs = event.data.config

  const consoleLog = (message) => {
    configs.forEach(config => {
      if (config.enabled && config.debug) {
        console.log(message, config)
      }
    })
  }

  // Log all received configs
  consoleLog('Configs received in injected script:', configs)

  // Function to check if a URL matches any of the configs
  const getMatchingConfig = (url) => {
    return configs.find(
      config => url && config.enabled && url.includes(config.urlContains))
  }

  // Override XMLHttpRequest
  const originalXMLHttpRequest = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (
    method, url, async, user, password) {
    consoleLog(`Intercepted XMLHttpRequest to URL: ${url}`)

    const matchingConfig = getMatchingConfig(url)
    if (matchingConfig) {
      const originalUrl = url
      url = url.replace(matchingConfig.replaceText, matchingConfig.withText)
      consoleLog(
        `Modified URL from ${originalUrl} to ${url} for config: ${matchingConfig.name}`)
    } else {
      consoleLog('No modification needed for this URL.')
    }

    arguments[1] = url
    return originalXMLHttpRequest.apply(this, arguments)
  }

  // Override fetch
  const originalFetch = window.fetch
  window.fetch = function (input, init) {
    let url = typeof input === 'string' ? input : input.url
    consoleLog(`Intercepted fetch request to URL: ${url}`)

    const matchingConfig = getMatchingConfig(url)
    if (matchingConfig) {
      const originalUrl = url
      url = url.replace(matchingConfig.replaceText, matchingConfig.withText)
      consoleLog(
        `Modified URL from ${originalUrl} to ${url} for config: ${matchingConfig.name}`)

      if (typeof input === 'string') {
        input = url
      } else {
        input = { ...input, url }
      }
    } else {
      consoleLog('No modification needed for this URL.')
    }

    return originalFetch.call(this, input, init)
  }

})
