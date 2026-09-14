
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

export function matchesRedirectConfig(url, config) {
    const source = config?.urlContains || config?.from || '';
    return Boolean(url && config?.enabled && source && !source.includes('*') && String(url).includes(source));
}

export function findMatchingRedirectConfig(url) {
    if (currentConfigs.systemEnabled === false) return undefined;
    const apiRedirectConfigs = currentConfigs[ConfigType.API_REDIRECT]?.configs || [];
    return apiRedirectConfigs.find(config => matchesRedirectConfig(url, config));
}

export function findMatchingInterceptConfig(url, method) {
    if (currentConfigs.systemEnabled === false) return undefined;
    const apiInterceptConfigs = currentConfigs[ConfigType.API_INTERCEPT]?.configs || [];
    return apiInterceptConfigs.find((config) =>
        url && config.enabled &&
        matchesInterceptConfig(url, method, config)
    );
}

export function matchesInterceptConfig(url, method, config) {
    const pattern = config?.interceptUrlContains || config?.pattern || '';
    const configuredMethod = (config?.interceptRequestMethod || config?.method || '').toUpperCase();
    return Boolean(url && config?.enabled && pattern && !pattern.includes('*') &&
        String(url).includes(pattern) &&
        (configuredMethod === 'ALL' || configuredMethod === (method || '').toUpperCase()));
}
