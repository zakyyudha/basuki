
// src/content/utils/configMatcher.js
export const ConfigType = {
    API_REDIRECT: 'apiRedirect',
    API_INTERCEPT: 'apiIntercept',
};

let currentConfigs = {
    apiRedirect: { configs: [] },
    apiIntercept: { configs: [] },
};

export function updateConfigs(newConfigs) {
    currentConfigs = newConfigs;
}

export function findMatchingRedirectConfig(url) {
    const apiRedirectConfigs = currentConfigs[ConfigType.API_REDIRECT]?.configs || [];
    return apiRedirectConfigs.find(
        config => url && config.enabled && (url || '').includes(config.urlContains)
    );
}

export function findMatchingInterceptConfig(url, method) {
    const apiInterceptConfigs = currentConfigs[ConfigType.API_INTERCEPT]?.configs || [];
    return apiInterceptConfigs.find((config) =>
        url && config.enabled &&
        url.includes(config.interceptUrlContains) &&
        config.interceptRequestMethod === (method || '').toUpperCase()
    );
}

