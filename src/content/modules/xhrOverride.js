
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
    if (!interceptConfig || xhr.__basukiInterceptApplied) return;

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
}

export function applyXHROverride() {
    const originalXMLHttpRequestOpen = XMLHttpRequest.prototype.open;

    XMLHttpRequest.prototype.open = function (method, url, ...args) {
        const redirectConfig = findMatchingRedirectConfig(url);
        const interceptConfig = findMatchingInterceptConfig(url, method);

        if (redirectConfig) {
            const originalUrl = url;
            url = url.replace(redirectConfig.replaceText, redirectConfig.withText);
            log(`[xhr] Redirect: ${originalUrl} → ${url}`);
            emitHit('redirect', redirectConfig.id, { from: originalUrl, to: url, name: redirectConfig.configName });
            emitLog('info', 'redirect', `[xhr] ${redirectConfig.configName}: ${originalUrl} → ${url}`);
        }

        const applyFinalIntercept = () => {
            if (this.readyState !== 4 || !interceptConfig) return;

            const alreadyApplied = this.__basukiInterceptApplied;
            applyInterceptResponse(this, interceptConfig);
            if (alreadyApplied) return;
            log('Intercepting response for:', url);
            emitHit('intercept', interceptConfig.id, { url, status: interceptConfig.interceptHttpStatusCode });
            emitLog('info', 'intercept', `[xhr] ${interceptConfig.interceptConfigName || interceptConfig.name}: ${url} → HTTP ${interceptConfig.interceptHttpStatusCode}`);
        };

        // Registered during open(), before page code usually attaches final handlers.
        // This applies mock properties before later readystatechange/load/loadend listeners read them.
        this.addEventListener('readystatechange', applyFinalIntercept);
        this.addEventListener('load', applyFinalIntercept);
        this.addEventListener('loadend', applyFinalIntercept);

        return originalXMLHttpRequestOpen.apply(this, [method, url, ...args]);
    };
}
