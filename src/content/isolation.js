// Content script for session isolation - Injected into isolated tabs
// This overrides fetch/XHR to inject isolated cookies from extension storage

import { log } from './utils/logger.js'

let isolatedCookies = []
let tabHost = ''
let isIsolationActive = false

// Initialize isolation for this tab
window.addEventListener('message', (event) => {
  if (event.source !== window || event.data.type !== 'BASUKI_ISOLATION_INIT') {
    return
  }

  const { cookies, host } = event.data
  isolatedCookies = cookies || []
  tabHost = host
  isIsolationActive = true

  log('🔒 Session isolation activated')
  log(`📋 Loaded ${isolatedCookies.length} isolated cookies for ${host}`)

  // Apply cookie isolation overrides
  applyFetchOverride()
  applyXHROverride()
})

// Listen for cookie updates from background
window.addEventListener('message', (event) => {
  if (event.source !== window || event.data.type !== 'BASUKI_ISOLATION_UPDATE') {
    return
  }

  isolatedCookies = event.data.cookies || []
  log(`🔄 Updated isolated cookies: ${isolatedCookies.length} cookies`)
})

// Build Cookie header from isolated cookies
function buildCookieHeader(url) {
  if (!isIsolationActive || isolatedCookies.length === 0) {
    return null
  }

  try {
    const urlObj = new URL(url)

    // Filter cookies that match this request
    const matchingCookies = isolatedCookies.filter(cookie => {
      const cookieDomain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain
      const urlHostname = urlObj.hostname

      const domainMatches = urlHostname === cookieDomain || urlHostname.endsWith('.' + cookieDomain)
      const pathMatches = urlObj.pathname.startsWith(cookie.path || '/')
      const secureMatches = !cookie.secure || urlObj.protocol === 'https:'

      return domainMatches && pathMatches && secureMatches
    })

    if (matchingCookies.length === 0) {
      return null
    }

    return matchingCookies.map(c => `${c.name}=${c.value}`).join('; ')
  } catch (error) {
    log('Error building cookie header:', error)
    return null
  }
}

// Parse Set-Cookie from response
function parseSetCookie(setCookieHeader, url) {
  if (!setCookieHeader) return null

  try {
    const urlObj = new URL(url)
    const parts = setCookieHeader.split(';').map(p => p.trim())
    const [nameValue] = parts
    const [name, value] = nameValue.split('=')

    if (!name) return null

    const cookie = {
      name: name.trim(),
      value: value ? value.trim() : '',
      domain: urlObj.hostname,
      path: '/',
      secure: urlObj.protocol === 'https:',
      httpOnly: false,
      sameSite: 'lax'
    }

    // Parse attributes
    parts.slice(1).forEach(part => {
      const [key, val] = part.split('=')
      const lowerKey = key.toLowerCase().trim()

      if (lowerKey === 'domain') cookie.domain = val
      else if (lowerKey === 'path') cookie.path = val
      else if (lowerKey === 'secure') cookie.secure = true
      else if (lowerKey === 'httponly') cookie.httpOnly = true
      else if (lowerKey === 'samesite') cookie.sameSite = val.toLowerCase()
    })

    return cookie
  } catch (error) {
    log('Error parsing Set-Cookie:', error)
    return null
  }
}

// Send cookies to background for storage
function saveCookiesToBackground(cookies) {
  if (!cookies || cookies.length === 0) return

  window.postMessage({
    type: 'BASUKI_ISOLATION_SAVE_COOKIES',
    cookies
  }, '*')

  log(`💾 Saved ${cookies.length} cookies to background`)
}

// Override fetch to inject isolated cookies
function applyFetchOverride() {
  const originalFetch = window.fetch

  window.fetch = async function (input, init) {
    if (!isIsolationActive) {
      return originalFetch.call(this, input, init)
    }

    const url = typeof input === 'string' ? input : input.url
    const cookieHeader = buildCookieHeader(url)

    // Clone init to avoid mutating original
    const modifiedInit = init ? { ...init } : {}
    modifiedInit.headers = new Headers(modifiedInit.headers || {})

    // Remove existing Cookie header
    modifiedInit.headers.delete('Cookie')

    // Add isolated cookies
    if (cookieHeader) {
      modifiedInit.headers.set('Cookie', cookieHeader)
      log(`🍪 Fetch: Injected isolated cookies for ${url}`)
    } else {
      log(`📭 Fetch: No cookies for ${url}`)
    }

    // Make request
    const response = await originalFetch.call(this, input, modifiedInit)

    // Capture Set-Cookie from response
    const setCookieHeader = response.headers.get('Set-Cookie')
    if (setCookieHeader) {
      const cookie = parseSetCookie(setCookieHeader, url)
      if (cookie) {
        // Update local cookies
        isolatedCookies = isolatedCookies.filter(c => c.name !== cookie.name)
        isolatedCookies.push(cookie)

        // Save to background
        saveCookiesToBackground([cookie])

        log(`📥 Fetch: Captured Set-Cookie: ${cookie.name}`)
      }
    }

    return response
  }

  log('✅ Fetch override applied for session isolation')
}

// Override XMLHttpRequest to inject isolated cookies
function applyXHROverride() {
  const OriginalXHR = window.XMLHttpRequest

  window.XMLHttpRequest = function () {
    const xhr = new OriginalXHR()
    const originalOpen = xhr.open
    const originalSend = xhr.send
    const originalSetRequestHeader = xhr.setRequestHeader

    let requestUrl = ''
    let requestHeaders = {}

    // Override open to capture URL
    xhr.open = function (method, url, ...args) {
      requestUrl = url
      return originalOpen.call(this, method, url, ...args)
    }

    // Override setRequestHeader to track headers
    xhr.setRequestHeader = function (name, value) {
      requestHeaders[name.toLowerCase()] = value
      return originalSetRequestHeader.call(this, name, value)
    }

    // Override send to inject cookies
    xhr.send = function (...args) {
      if (isIsolationActive && requestUrl) {
        const cookieHeader = buildCookieHeader(requestUrl)

        if (cookieHeader) {
          // Remove existing Cookie header if set
          delete requestHeaders['cookie']

          // Set isolated cookies
          originalSetRequestHeader.call(xhr, 'Cookie', cookieHeader)
          log(`🍪 XHR: Injected isolated cookies for ${requestUrl}`)
        } else {
          log(`📭 XHR: No cookies for ${requestUrl}`)
        }

        // Listen for response to capture Set-Cookie
        xhr.addEventListener('readystatechange', function () {
          if (xhr.readyState === 4) {
            const setCookie = xhr.getResponseHeader('Set-Cookie')
            if (setCookie) {
              const cookie = parseSetCookie(setCookie, requestUrl)
              if (cookie) {
                isolatedCookies = isolatedCookies.filter(c => c.name !== cookie.name)
                isolatedCookies.push(cookie)
                saveCookiesToBackground([cookie])
                log(`📥 XHR: Captured Set-Cookie: ${cookie.name}`)
              }
            }
          }
        })
      }

      return originalSend.apply(this, args)
    }

    return xhr
  }

  // Preserve constructor properties
  window.XMLHttpRequest.prototype = OriginalXHR.prototype

  log('✅ XHR override applied for session isolation')
}

// Export for bundling
export { applyFetchOverride, applyXHROverride }
