import assert from 'node:assert/strict'
import { validateImportSnapshot } from '../src/popup/utils/importValidation.js'
import { looksLikeJson, isValidJson, validateRedirectDestination, validateSessionOrigin } from '../src/popup/utils/validation.js'
import { matchesInterceptConfig, matchesRedirectConfig } from '../src/content/utils/configMatcher.js'

assert.equal(validateRedirectDestination('http://localhost:3000').ok, true)
assert.equal(validateRedirectDestination('https://api.example.com/v1').ok, true)
assert.equal(validateRedirectDestination('htp://localhost:3000').ok, false)
assert.equal(validateRedirectDestination('javascript:alert(1)').ok, false)
assert.equal(validateSessionOrigin('app.example.com').value, 'https://app.example.com/')
assert.equal(validateSessionOrigin('https://app.example.com/path?q=1').value, 'https://app.example.com/path?q=1')
assert.equal(looksLikeJson('  {"ok": true}'), true)
assert.equal(isValidJson('{"ok": true}'), true)
assert.equal(isValidJson('{oops'), false)

assert.deepEqual(validateImportSnapshot({ redirect: { configs: [] } }), {
  ok: true,
  counts: { redirects: 0, intercepts: 0, sessions: 0 },
})
assert.equal(validateImportSnapshot({}).ok, false)
assert.equal(validateImportSnapshot({ redirect: { configs: {} } }).ok, false)
assert.equal(matchesRedirectConfig('https://api.example.com/v1/users', { enabled: true, from: 'api.example.com/v1' }), true)
assert.equal(matchesRedirectConfig('https://api.example.com/v1/users', { enabled: true, from: 'api.example.com/*' }), false)
assert.equal(matchesInterceptConfig('https://api.example.com/v1/users', 'POST', { enabled: true, pattern: '/v1/', method: 'ALL' }), true)
console.log('UX follow-up validation checks passed')
