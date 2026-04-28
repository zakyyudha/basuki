// Modularized intercept script
import { updateConfigs } from './utils/configMatcher.js';
import { applyXHROverride } from './modules/xhrOverride.js';
import { applyFetchOverride } from './modules/fetchOverride.js';
import { applyAxiosPatch } from './modules/axiosPatch.js';

window.addEventListener('message', (event) => {
  if (event.source !== window || event.data.type !== 'BASUKI_CONFIG') {
    return;
  }

  const configs = event.data.config;

  // Log received configs
  console.log('[Basuki Injected] Received configs in injected script:', configs);

  // Update config matcher with new configs
  updateConfigs(configs);

  // Apply all HTTP method overrides
  applyXHROverride();
  applyFetchOverride();
  applyAxiosPatch();

  console.log('[Basuki Injected] All HTTP overrides applied successfully');
});
