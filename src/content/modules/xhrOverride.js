
// src/content/modules/xhrOverride.js
import { findMatchingRedirectConfig, findMatchingInterceptConfig } from '../utils/configMatcher.js';
import { log } from '../utils/logger.js';

function emitHit(kind, id, meta = {}) {
    window.postMessage({ type: 'BASUKI_HIT', kind, id, ...meta }, '*');
}

function emitLog(level, scope, message, meta = {}) {
    window.postMessage({ type: 'BASUKI_LOG', level, scope, message, ...meta }, '*');
}

function parseJsonSafely(value) {
    try {
        return JSON.parse(value);
    } catch (error) {
        return value;
    }
}

function defineMockGetter(target, key, getter) {
    try {
        Object.defineProperty(target, key, {
            configurable: true,
            get: getter,
        });
    } catch (error) {
        console.warn(`[xhr] Failed to override ${key}`, error);
    }
}

function applyInterceptResponse(xhr, interceptConfig) {
    if (!interceptConfig || xhr.__basukiInterceptApplied) return false;

    const responseBody = String(interceptConfig.interceptResponseBody ?? '');
    const responseStatus = Number(interceptConfig.interceptHttpStatusCode || 200);
    const responseStatusText = responseStatus >= 200 && responseStatus < 300 ? 'OK' : 'Mocked';
    const contentType = 'application/json; charset=utf-8';
    const responseValue = xhr.responseType === 'json'
        ? parseJsonSafely(responseBody)
        : responseBody;

    defineMockGetter(xhr, 'responseText', () => responseBody);
    defineMockGetter(xhr, 'response', () => responseValue);
    defineMockGetter(xhr, 'status', () => responseStatus);
    defineMockGetter(xhr, 'statusText', () => responseStatusText);
    defineMockGetter(xhr, 'getResponseHeader', () => (name) => {
        if ((name || '').toLowerCase() === 'content-type') return contentType;
        return null;
    });
    defineMockGetter(xhr, 'getAllResponseHeaders', () => () => `content-type: ${contentType}\r\n`);

    xhr.__basukiInterceptApplied = true;
    return true;
}

function relayRequest(url, method, headers = {}, body, sourceUrl) {
    return new Promise((resolve, reject) => {
        const requestId = `basuki-${Date.now()}-${Math.random()}`;
        const listener = (event) => {
            if (event.source !== window || event.data?.type !== 'BASUKI_PROXY_RESPONSE' || event.data.requestId !== requestId) return;
            window.removeEventListener('message', listener);
            const response = event.data.response;
            if (!response?.ok) return reject(new Error(response?.error || 'Basuki proxy request failed'));
            resolve(new Response(new Uint8Array(response.body || []), { status: response.status, statusText: response.statusText, headers: response.headers }));
        };
        window.addEventListener('message', listener);
        window.postMessage({ type: 'BASUKI_PROXY_REQUEST', requestId, url, method, headers, body, sourceUrl }, '*');
    });
}

export function applyXHROverride() {
    if (window.__basukiXhrOverrideApplied) return;
    window.__basukiXhrOverrideApplied = true;
    const originalXMLHttpRequestOpen = XMLHttpRequest.prototype.open;
    const originalXMLHttpRequestSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...args) {
        const redirectConfig = findMatchingRedirectConfig(url);
        const isLocalProxy = redirectConfig && /^https?:\/\/localhost(?::\d+)?\//i.test(redirectConfig.withText);
        if (isLocalProxy) {
            const originalUrl = url;
            this.__basukiRelay = { method, url: url.replace(redirectConfig.replaceText, redirectConfig.withText), sourceUrl: originalUrl, headers: {} };
            log(`[xhr] Proxy redirect: ${originalUrl} → ${this.__basukiRelay.url}`);
            emitHit('redirect', redirectConfig.id, { from: originalUrl, to: this.__basukiRelay.url, name: redirectConfig.configName });
            emitLog('info', 'redirect', `[xhr] ${redirectConfig.configName}: ${originalUrl} → ${this.__basukiRelay.url}`);
            const opened = originalXMLHttpRequestOpen.apply(this, [method, originalUrl, ...args]);
            const xhr = this;
            xhr.setRequestHeader = (name, value) => {
                xhr.__basukiRelay.headers[name] = value;
            };
            return opened;
        }
        const redirectConfigForNormal = redirectConfig;
        if (!redirectConfigForNormal) {
            const interceptConfig = findMatchingInterceptConfig(url, method);
            const applyFinalIntercept = () => {
                if (this.readyState !== 4 || !interceptConfig) return;
                if (applyInterceptResponse(this, interceptConfig)) {
                    const status = Number(interceptConfig.interceptHttpStatusCode || 200);
                    emitHit('intercept', interceptConfig.id, { url, status });
                    emitLog('info', 'intercept', `[xhr] ${interceptConfig.interceptConfigName || interceptConfig.name}: ${url} → HTTP ${status}`);
                }
            };
            this.addEventListener('readystatechange', applyFinalIntercept);
            this.addEventListener('load', applyFinalIntercept);
            this.addEventListener('loadend', applyFinalIntercept);
            return originalXMLHttpRequestOpen.apply(this, [method, url, ...args]);
        }
        url = url.replace(redirectConfig.replaceText, redirectConfig.withText);
        return originalXMLHttpRequestOpen.apply(this, [method, url, ...args]);
    };

    XMLHttpRequest.prototype.send = function (body) {
        if (!this.__basukiRelay) return originalXMLHttpRequestSend.call(this, body);
        const relay = this.__basukiRelay;
        relayRequest(relay.url, relay.method, relay.headers, body, relay.sourceUrl).then(async (response) => {
            const text = await response.text();
            Object.defineProperty(this, 'status', { configurable: true, value: response.status });
            Object.defineProperty(this, 'responseText', { configurable: true, value: text });
            Object.defineProperty(this, 'response', { configurable: true, value: this.responseType === 'json' ? JSON.parse(text) : text });
            Object.defineProperty(this, 'readyState', { configurable: true, value: 4 });
            this.dispatchEvent(new Event('readystatechange'));
            this.dispatchEvent(new Event('load'));
            this.dispatchEvent(new Event('loadend'));
        }).catch(() => this.dispatchEvent(new Event('error')));
    };
}
