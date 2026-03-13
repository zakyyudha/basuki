# Refactoring Plan for Basuki Chrome Extension

## Phase 1: Modularization and Readability ✅ **COMPLETED**

1.  **Update `manifest.json` paths:**
    *   Adjust `service_worker`, `content_scripts`, and `web_accessible_resources` to `src/` directory. ✅ (Completed)
    *   Add `"type": "module"` to the `background` object in `manifest.json`. ✅ (Completed)

2.  **Background Script Refactoring (`src/background/index.js`):**
    *   Create `src/background/modules` and `src/background/utils` directories. ✅ (Completed)
    *   Move `background.js` to `src/background/index.js`. ✅ (Completed)
    *   Extract `updateStorage` and `getStorageData` into `src/background/utils/storage.js`. ✅ (Completed)
    *   Extract `checkForUpdates` and `notifyUserAboutUpdate` into `src/background/modules/updateChecker.js`. ✅ (Completed)
    *   Extract all session isolation logic (functions and listeners) into `src/background/modules/sessionIsolation.js`. ✅ (Completed)
    *   Extract context menu creation and click handling into `src/background/utils/contextMenus.js`. ✅ (Completed)
    *   Refactor `src/background/index.js` to import and orchestrate these new modules/utilities. ✅ (Completed)

3.  **Content Script Analysis and Refactoring (`src/content/`):**
    *   Analyze `src/content/isolation.js`: Removed as it was a non-functional remnant. ✅ (Completed)
    *   Analyze `src/content/sidebars.js`: Moved to `src/popup/utils/ui.js` and functions exported. ✅ (Completed)

4.  **Popup Script Refactoring (`src/popup/index.js`):**
    *   Create `src/popup/modules` and `src/popup/utils` directories. ✅ (Completed)
    *   Extract `ConfigManager` and related constants (`CONFIG_KIND`, `VALUE_IDS`) into `src/popup/modules/configManager.js`. ✅ (Completed)
    *   Extract validation functions (`validateRedirectForm`, `validateInterceptForm`, `getElementValue`) into `src/popup/utils/validation.js`. ✅ (Completed)
    *   Extract `SessionIsolationManager` into `src/popup/modules/sessionIsolationUI.js`. ✅ (Completed)
    *   Refactor `src/popup/index.js` to import and initialize these new modules and utilities. ✅ (Completed)
    *   Update `popup.html` to load `src/popup/index.js` as a module. ✅ (Completed)

## Phase 2: Build System Integration ✅ **COMPLETED**

1.  **Webpack Setup:**
    *   Initialize `npm` project and install Webpack and necessary loaders/plugins. ✅ (Completed)
    *   Create `webpack.config.js`. ✅ (Completed)
    *   Configure `webpack.config.js` with multiple entry points: `src/background/index.js`, `src/popup/index.js`, `src/content/index.js`, and `src/content/intercept.js`. ✅ (Completed)
    *   Define output paths for bundled files (e.g., `dist/background.js`, `dist/popup.js`, `dist/content.js`, `dist/intercept.js`). ✅ (Completed)

2.  **Webpack Plugins:**
    *   Add `clean-webpack-plugin` to clear the `dist` folder before each build. ✅ (Completed)
    *   Use `copy-webpack-plugin` to copy static assets to `dist`:
        *   `manifest.json` (script paths updated for bundled files via transform). ✅ (Completed)
        *   `popup.html` (script path updated for bundled popup.js via transform). ✅ (Completed)
        *   `images/` directory. ✅ (Completed)
        *   `styles/` directory. ✅ (Completed)
        *   `assets/` directory (Bootstrap CSS/JS). ✅ (Completed)

3.  **Development and Production Builds:**
    *   Configure Webpack to generate source maps for debugging in development. ✅ (Completed)
    *   Configure Webpack for minification and optimization in production. ✅ (Completed)
    *   Build commands available: `npm run build`, `npm run build:dev`, `npm run watch`. ✅ (Completed)

4.  **Update `manifest.json` for Bundled Files:**
    *   Modify `manifest.json` to point `service_worker` to bundled `background.js`. ✅ (Completed)
    *   Adjust `content_scripts` `js` array to point to bundled `content.js`. ✅ (Completed)
    *   Adjust `web_accessible_resources` to include bundled `intercept.js`. ✅ (Completed)

5.  **Bug Fixes During Integration:**
    *   Fixed popup storage utilities (created `src/popup/utils/storage.js`). ✅ (Completed)
    *   Fixed content script config check logic (AND → OR). ✅ (Completed)
    *   Fixed intercept.js injection path. ✅ (Completed)
    *   Fixed popup.html script path in webpack transform. ✅ (Completed)
    *   Added comprehensive debug logging throughout. ✅ (Completed)

## Phase 3: Testing ⏳ **PENDING**

1.  **Unit Testing:**
    *   Set up a testing framework (e.g., Jest). ⏳ (Pending)
    *   Write unit tests for utility functions (e.g., `storage.js`, `validation.js`, `configMatcher.js`, `logger.js`). ⏳ (Pending)
    *   Write unit tests for core logic in modules (e.g., `sessionIsolation.js`, `configManager.js`). ⏳ (Pending)
    *   Write unit tests for HTTP override modules (`xhrOverride.js`, `fetchOverride.js`, `axiosPatch.js`). ⏳ (Pending)

2.  **End-to-End Testing:**
    *   Research and select an E2E testing framework for Chrome Extensions (e.g., Playwright, Cypress with extension support). ⏳ (Pending)
    *   Write E2E tests for key extension flows:
        *   API redirection functionality (XHR, Fetch, Axios). ⏳ (Pending)
        *   API interception functionality (XHR, Fetch, Axios). ⏳ (Pending)
        *   Session isolation (creating, activating, renaming, removing tabs). ⏳ (Pending)
        *   Context menu interactions. ⏳ (Pending)
        *   Popup UI interactions (save, edit, delete configs). ⏳ (Pending)

## Phase 4: Content Script Refinement ✅ **COMPLETED**

1.  **Review `src/content/index.js`:**
    *   Enhanced with comprehensive debug logging. ✅ (Completed)
    *   Added defensive error handling for chrome.runtime. ✅ (Completed)
    *   Clarified interaction patterns with the background script. ✅ (Completed)

2.  **Refactor `src/content/intercept.js`:**
    *   Fully modularized intercept.js (240 lines → 27 lines). ✅ (Completed)
    *   Created modular structure:
        *   `src/content/modules/xhrOverride.js` - XMLHttpRequest override. ✅ (Completed)
        *   `src/content/modules/fetchOverride.js` - Fetch API override. ✅ (Completed)
        *   `src/content/modules/axiosPatch.js` - Axios interceptor patching. ✅ (Completed)
        *   `src/content/utils/configMatcher.js` - Config matching logic. ✅ (Completed)
        *   `src/content/utils/logger.js` - Logging utility. ✅ (Completed)
    *   Fixed incomplete log statements in all modules. ✅ (Completed)
    *   Fixed fetch method defaulting bug (undefined → 'GET'). ✅ (Completed)
    *   Verified correct injection and communication with content script. ✅ (Completed)

## Phase 5: Finalization ⏳ **PENDING**

1.  **Documentation:**
    *   Update `readme.md` with:
        *   Build instructions (`npm run build`, `npm run build:dev`, `npm run watch`). ⏳ (Pending)
        *   Development workflow and project structure. ⏳ (Pending)
        *   Testing guide (once Phase 3 is complete). ⏳ (Pending)
        *   Installation and usage instructions. ⏳ (Pending)
    *   Add code comments where needed for clarity. ⏳ (Pending)

2.  **Code Review:**
    *   Perform a final review to ensure code quality, consistency, and adherence to best practices. ⏳ (Pending)
    *   Check for any remaining TODO comments or placeholder code. ⏳ (Pending)
    *   Verify all error handling is appropriate. ⏳ (Pending)

3.  **Performance Audit:**
    *   Conduct a light performance audit:
        *   Check bundle sizes and optimize if needed. ⏳ (Pending)
        *   Profile content script performance impact. ⏳ (Pending)
        *   Verify memory usage is reasonable. ⏳ (Pending)
    *   Add performance monitoring if necessary. ⏳ (Pending)

4.  **Version Control:**
    *   Add comprehensive `.gitignore`. ✅ (Completed)
    *   Prepare for initial git commit. ⏳ (Pending)
    *   Create release notes for v2.0.0. ⏳ (Pending)

---

## Summary of Current Status

### ✅ Completed (3/5 phases)
- **Phase 1**: Modularization and Readability
- **Phase 2**: Build System Integration
- **Phase 4**: Content Script Refinement

### ⏳ Remaining (2/5 phases)
- **Phase 3**: Testing (Unit + E2E)
- **Phase 5**: Finalization (Documentation, Review, Performance)

### 🎯 Next Priority
**Phase 3: Testing** - Set up Jest and write comprehensive tests for all modules.

---

**Extension Status**: Fully functional with modular architecture, webpack build system, and working API redirect/intercept features. Ready for testing and documentation phases.
