
// src/content/modules/axiosPatch.js
import { findMatchingRedirectConfig, findMatchingInterceptConfig } from '../utils/configMatcher.js';
import { log } from '../utils/logger.js';

export function applyAxiosPatch() {
    const ensureString = (value) => (typeof value === 'string' ? value : (value == null ? '' : String(value)));

    const buildFullUrl = (config) => {
        const rawUrl = ensureString(config?.url);
        const baseURL = ensureString(config?.baseURL);
        try {
            if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
            if (baseURL) return new URL(rawUrl || '', baseURL).toString();
            return rawUrl;
        } catch (e) {
            return rawUrl;
        }
    };

    const applyAxiosInterceptors = (axiosInstance) => {
        if (!axiosInstance || !axiosInstance.interceptors) return;

        if (axiosInstance.__basukiInterceptorsApplied) return;

        axiosInstance.interceptors.request.use((config) => {
            const fullUrl = buildFullUrl(config);
            const method = (config?.method || 'GET').toUpperCase();

            const redirectConfig = findMatchingRedirectConfig(fullUrl);
            if (redirectConfig) {
                const originalUrl = fullUrl;
                const replaced = fullUrl.replace(redirectConfig.replaceText, redirectConfig.withText);
                if (typeof config.url === 'string' && !/^https?:\/\//i.test(config.url) && config.baseURL) {
                    try {
                        const base = new URL(config.baseURL);
                        const relative = replaced.startsWith(base.origin) ? replaced.slice(base.origin.length) : replaced;
                        config.url = relative;
                    } catch {
                        config.url = replaced;
                    }
                } else {
                    config.url = replaced;
                }
                if (redirectConfig.debug) {
                    log(`Axios redirected URL from ${originalUrl} to ${config.url} for config: ${redirectConfig.configName}`);
                }
            }

            const interceptConfig = findMatchingInterceptConfig(fullUrl, method);
            if (interceptConfig) {
                const status = Number(interceptConfig.interceptHttpStatusCode);
                let body = interceptConfig.interceptResponseBody;
                try {
                    body = JSON.parse(body);
                } catch {
                }

                const statusText = status >= 200 && status < 300 ? 'OK' : (status === 404 ? 'Not Found' : (status === 400 ? 'Bad Request' : (status === 401 ? 'Unauthorized' : (status === 500 ? 'Internal Server Error' : ''))));

                if (interceptConfig.debug) {
                    log('Axios intercept — modified status:', status);
                    log('Axios intercept — modified response:', body);
                }

                config.adapter = async () => ({
                    data: body,
                    status,
                    statusText,
                    headers: config.headers || {},
                    config,
                    request: {}
                });
            }

            return config;
        });

        Object.defineProperty(axiosInstance, '__basukiInterceptorsApplied', { value: true, enumerable: false });
    };

    const attachIfAvailable = () => {
        const ax = window.axios;
        if (!ax) return false;

        applyAxiosInterceptors(ax);

        if (!ax.__basukiCreatePatched && typeof ax.create === 'function') {
            const originalCreate = ax.create.bind(ax);
            ax.create = function patchedCreate(...args) {
                const instance = originalCreate(...args);
                applyAxiosInterceptors(instance);
                return instance;
            };
            Object.defineProperty(ax, '__basukiCreatePatched', { value: true, enumerable: false });
        }

        return true;
    };

    if (attachIfAvailable()) return;

    const maxTries = 50; // ~5s
    let tries = 0;
    const timer = setInterval(() => {
        tries += 1;
        if (attachIfAvailable() || tries >= maxTries) {
            clearInterval(timer);
        }
    }, 100);
}

