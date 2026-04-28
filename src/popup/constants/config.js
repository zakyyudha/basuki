
export const CONFIG_KIND = {
  API_REDIRECT: 'apiRedirect',
  API_INTERCEPT: 'apiIntercept',
}

export const VALUE_IDS = {
  API_REDIRECT: ['id', 'configName', 'urlContains', 'replaceText', 'withText'],
  API_INTERCEPT: [
    'id',
    'interceptConfigName',
    'interceptUrlContains',
    'interceptHttpStatusCode',
    'interceptRequestMethod',
    'interceptResponseBody',
  ],
}

export const WORKFLOW_IDS = {
  REDIRECT: 'apiRedirector',
  INTERCEPT: 'interceptRequest',
  SESSION: 'sessionIsolation',
}

export const COPY_KEYS = {
  REDIRECT: 'redirect',
  INTERCEPT: 'intercept',
  SESSION: 'session',
}
