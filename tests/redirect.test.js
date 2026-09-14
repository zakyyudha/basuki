import assert from 'node:assert/strict';
import { matchesRedirectConfig } from '../src/content/utils/configMatcher.js';

const rule = {
  enabled: true,
  urlContains: 'https://maas-api-staging.mytens.id/buying',
};

assert.equal(matchesRedirectConfig(
  'https://maas-api-staging.mytens.id/buying/project/1', rule,
), true);
assert.equal(matchesRedirectConfig('https://other.example/buying/project/1', rule), false);
assert.equal(matchesRedirectConfig('https://maas-api-staging.mytens.id/buying', {
  ...rule,
  enabled: false,
}), false);
assert.equal(matchesRedirectConfig('https://example.test', { enabled: true, urlContains: '' }), false);
console.log('redirect matcher checks passed');
