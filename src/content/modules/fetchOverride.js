
// src/content/modules/fetchOverride.js
import { findMatchingRedirectConfig, findMatchingInterceptConfig } from '../utils/configMatcher.js';
import { log } from '../utils/logger.js';

function emitHit(kind, id, meta = {}) {
    window.postMessage({ type: 'BASUKI_HIT', kind, id, ...meta }, '*');
}

function emitLog(level, scope, message, meta = {}) {
    window.postMessage({ type: 'BASUKI_LOG', level, scope, message, ...meta }, '*');
}

async function relayFetch(url, request) {
    const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.clone().arrayBuffer();
    return new Promise((resolve, reject) => {
        const requestId = `basuki-fetch-${Date.now()}-${Math.random()}`;
        const listener = (event) => {
            if (event.source !== window || event.data?.type !== 'BASUKI_PROXY_RESPONSE' || event.data.requestId !== requestId) return;
            window.removeEventListener('message', listener);
            const response = event.data.response;
            if (!response?.ok) return reject(new Error(response?.error || 'Basuki proxy request failed'));
            resolve(new Response(new Uint8Array(response.body || []), {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
            }));
        };
        window.addEventListener('message', listener);
        window.postMessage({
            type: 'BASUKI_PROXY_REQUEST',
            requestId,
            url,
            method: request.method,
            headers: Object.fromEntries(request.headers.entries()),
            body,
            sourceUrl: url,
        }, '*');
    });
}

export function applyFetchOverride() {
    if (window.__basukiFetchOverrideApplied) return;
    window.__basukiFetchOverrideApplied = true;
    const originalFetch = window.fetch;
    window.fetch = async function (input, init) {
        let url = typeof input === 'string' ? input : input?.url;
        const method = (init?.method || 'GET').toUpperCase();

        const redirectConfig = findMatchingRedirectConfig(url);
        const interceptConfig = findMatchingInterceptConfig(url, method);

        if (redirectConfig && /^https?:\/\/localhost(?::\d+)?\//i.test(redirectConfig.withText)) {
            const originalUrl = url;
            const targetUrl = url.replace(redirectConfig.replaceText, redirectConfig.withText);
            const request = input instanceof Request ? new Request(input, init) : new Request(url, init);
            log(`[fetch] Proxy redirect: ${originalUrl} → ${targetUrl}`);
            emitHit('redirect', redirectConfig.id, { from: originalUrl, to: targetUrl, name: redirectConfig.configName });
            emitLog('info', 'redirect', `[fetch] ${redirectConfig.configName}: ${originalUrl} → ${targetUrl}`);
            return relayFetch(targetUrl, request);
        }

        if (redirectConfig) {
            const originalUrl = url;
            url = url.replace(redirectConfig.replaceText, redirectConfig.withText);
            // Always emit hit and log for verbose debug — debug flag gates nothing anymore
            log(`[fetch] Redirect: ${originalUrl} → ${url}`);
            emitHit('redirect', redirectConfig.id, { from: originalUrl, to: url, name: redirectConfig.configName });
            emitLog('info', 'redirect', `[fetch] ${redirectConfig.configName}: ${originalUrl} → ${url}`);
            input = typeof input === 'string' ? url : new Request(url, input);
        }

        const response = await originalFetch.call(this, input, init);

        if (interceptConfig) {
            const clonedResponse = response.clone();
            const modifiedResponseText = interceptConfig.interceptResponseBody;
            const httpStatusCode = interceptConfig.interceptHttpStatusCode;
            log(`[fetch] Intercept: ${url} → HTTP ${httpStatusCode}`);
            emitHit('intercept', interceptConfig.id, { url, status: httpStatusCode });
            emitLog('info', 'intercept', `[fetch] ${interceptConfig.interceptConfigName || interceptConfig.name}: ${url} → HTTP ${httpStatusCode}`);

            return new Response(modifiedResponseText, {
                status: httpStatusCode,
                headers: clonedResponse.headers,
            });
        }

        return response;
    };
}
