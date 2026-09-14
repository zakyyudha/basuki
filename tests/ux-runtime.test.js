import assert from 'node:assert/strict'
import { updateConfigs, findMatchingRedirectConfig, findMatchingInterceptConfig } from '../src/content/utils/configMatcher.js'
const redirect = { id: 1, enabled: true, urlContains: '/api/' }
const intercept = { id: 2, enabled: true, interceptUrlContains: '/api/', interceptRequestMethod: 'ALL' }
updateConfigs({ systemEnabled: false, apiRedirect: { configs: [redirect] }, apiIntercept: { configs: [intercept] } })
assert.equal(findMatchingRedirectConfig('https://example.test/api/test'), undefined, 'paused redirect must not match')
assert.equal(findMatchingInterceptConfig('https://example.test/api/test', 'GET'), undefined, 'paused intercept must not match')
updateConfigs({ systemEnabled: true, apiRedirect: { configs: [redirect] }, apiIntercept: { configs: [intercept] } })
for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']) assert.equal(findMatchingInterceptConfig('https://example.test/api/test', method)?.id, 2, `ALL must match ${method}`)
assert.equal(findMatchingRedirectConfig('https://example.test/api/test')?.id, 1)
assert.equal(findMatchingInterceptConfig('https://example.test/other', 'GET'), undefined)
console.log('UX runtime checks passed: pause/resume redirect/intercept, ALL seven methods, nonmatch')
