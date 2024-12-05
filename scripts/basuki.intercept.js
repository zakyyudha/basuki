window.addEventListener('message', (event) => {
  if (event.source !== window || event.data.type !== 'BASUKI_CONFIG') {
    return
  }

  const ConfigType = {
    API_REDIRECT: 'apiRedirect',
    API_INTERCEPT: 'apiIntercept',
  }

  const configs = event.data.config
  const apiRedirectConfigs = configs[ConfigType.API_REDIRECT]?.configs || []
  const apiInterceptConfigs = configs[ConfigType.API_INTERCEPT]?.configs || []

  const logToConsole = (...messages) => console.log(...messages)

  // Log all received configs
  logToConsole('Received configs in injected script:', configs)

  // Helper functions to find matching configurations
  const findMatchingRedirectConfig = (url) =>
    apiRedirectConfigs.find(
      config => url && config.enabled &&
        (url || '').includes(config.urlContains))

  const findMatchingInterceptConfig = (url, method) =>
    apiInterceptConfigs.find((config) =>
      url && config.enabled &&
      url.includes(config.interceptUrlContains) &&
      config.interceptRequestMethod === (method || '').toUpperCase())

  // Override XMLHttpRequest
  const originalXMLHttpRequestOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    const redirectConfig = findMatchingRedirectConfig(url)
    const interceptConfig = findMatchingInterceptConfig(url, method)

    if (redirectConfig) {
      const originalUrl = url
      url = url.replace(redirectConfig.replaceText, redirectConfig.withText)
      if (redirectConfig.debug) {
        logToConsole(
          `Redirected URL from ${originalUrl} to ${url} for config: ${redirectConfig.configName}`)
      }
    }

    args[0] = url // Modify the request URL

    // Setup response interception
    this.addEventListener('readystatechange', function () {
      if (this.readyState === 4 && interceptConfig) {
        logToConsole('Intercepting response for:', url)
        const {
          interceptHttpStatusCode,
          interceptResponseBody,
          debug,
        } = interceptConfig
        const responseOverride = {
          status: Number(interceptHttpStatusCode),
          responseText: JSON.parse(interceptResponseBody),
        }

        if (debug) {
          logToConsole('Modified response:', responseOverride.responseText)
          logToConsole('New status:', responseOverride.status)
        }

        Object.defineProperties(this, {
          responseText: { value: responseOverride.responseText },
          status: { value: responseOverride.status },
        })

      }
    })

    return originalXMLHttpRequestOpen.apply(this, [method, url, ...args])
  }

  // Override fetch
  const originalFetch = window.fetch
  window.fetch = async function (input, init) {
    let url = typeof input === 'string' ? input : input.url
    const method = init?.method

    const redirectConfig = findMatchingRedirectConfig(url)
    const interceptConfig = findMatchingInterceptConfig(url, method)

    if (redirectConfig) {
      const originalUrl = url
      url = url.replace(redirectConfig.replaceText, redirectConfig.withText)
      if (redirectConfig.debug) {
        logToConsole(
          `Redirected URL from ${originalUrl} to ${url} for config: ${redirectConfig.configName}`)
      }

      input = typeof input === 'string' ? url : { ...input, url }
    }

    const response = await originalFetch.call(this, input, init)

    if (interceptConfig) {
      const clonedResponse = response.clone()
      const modifiedResponseText = interceptConfig.interceptResponseBody
      const { httpStatusCode, debug } = interceptConfig

      if (debug) {
        logToConsole('Modified HTTP status:', httpStatusCode)
        logToConsole('Modified response:', modifiedResponseText)
      }

      return new Response(modifiedResponseText, {
        status: httpStatusCode,
        headers: clonedResponse.headers,
      })
    }

    return response
  }
})
