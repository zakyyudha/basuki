
// src/content/modules/fetchOverride.js
import { findMatchingRedirectConfig, findMatchingInterceptConfig } from '../utils/configMatcher.js';
import { log } from '../utils/logger.js';

function emitHit(kind, id, meta = {}) {
    window.postMessage({ type: 'BASUKI_HIT', kind, id, ...meta }, '*');
}

function emitLog(level, scope, message, meta = {}) {
    window.postMessage({ type: 'BASUKI_LOG', level, scope, message, ...meta }, '*');
}

export function applyFetchOverride() {
    const originalFetch = window.fetch;
    window.fetch = async function (input, init) {
        let url = typeof input === 'string' ? input : input.url;
        const method = (init?.method || 'GET').toUpperCase();

        const redirectConfig = findMatchingRedirectConfig(url);
        const interceptConfig = findMatchingInterceptConfig(url, method);

        if (redirectConfig) {
            const originalUrl = url;
            url = url.replace(redirectConfig.replaceText, redirectConfig.withText);
            // Always emit hit and log for verbose debug — debug flag gates nothing anymore
            log(`[fetch] Redirect: ${originalUrl} → ${url}`);
            emitHit('redirect', redirectConfig.id, { from: originalUrl, to: url, name: redirectConfig.configName });
            emitLog('info', 'redirect', `[fetch] ${redirectConfig.configName}: ${originalUrl} → ${url}`);
            input = typeof input === 'string' ? url : { ...input, url };
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
