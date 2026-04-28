# Basuki v3 — Chrome Extension for API Testing & Development

**Basuki** is a Chrome extension for developer API workflows. It helps you redirect API requests, mock API responses, inspect runtime activity, and open isolated browser sessions from one React/Vite-powered MV3 popup.

![Version](https://img.shields.io/badge/version-3.0.0-blue)
![License](https://img.shields.io/badge/license-ISC-green)
![Chrome](https://img.shields.io/badge/chrome-extension-yellow)

## Features

### API Redirect

- Create, edit, enable/disable, and delete redirect rules.
- Match outgoing request URLs by pattern.
- Replace URL fragments to switch between local, staging, and production APIs.
- Track rule activity from the popup summary.
- Works through the content runtime for `XMLHttpRequest`, `fetch`, and common Axios usage.

### API Intercept

- Create mock response rules without changing application code.
- Configure URL pattern, HTTP method, status code, and JSON response body.
- Toggle rules safely from the popup.
- Validate status/body values before saving.
- Use runtime logs to confirm matching behavior.

### Session Isolation

- Launch isolated browser tabs from the popup.
- Keep session cookies separated for multi-account and multi-environment testing.
- Activate, rename, close, and delete isolated sessions through background runtime actions.
- View normalized session state in the React popup.

### Debug Toolkit

- View live redirect/intercept/session summary metrics.
- Review merged popup + runtime logs persisted under `basukiLogs`.
- Clear popup/runtime logs without deleting rule configuration.
- Export current configuration to JSON.
- Import configuration from JSON with invalid-file handling.
- Copy Status Summary for quick debugging handoff.

## Installation

### For Users

1. Download the latest release from [Releases](https://github.com/zakyyudha/basuki/releases).
2. Unzip the downloaded file.
3. Open Chrome and navigate to `chrome://extensions/`.
4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select the `dist` folder from the release bundle.
7. Pin or open Basuki from the Chrome toolbar.

### For Developers

```bash
git clone https://github.com/zakyyudha/basuki.git
cd basuki
pnpm install
pnpm run build:dev
```

Then load the generated `dist/` folder from `chrome://extensions/`.

## Usage

### Redirect a Request

1. Open the Basuki popup.
2. Go to the Redirect workflow.
3. Create or edit a rule with:
   - rule name
   - URL pattern to match
   - text to replace
   - replacement text
4. Save the rule.
5. Enable it from the rule list.
6. Reload the target web page and verify the request is redirected.

Example:

```text
Name: Switch production API to local
URL contains: api.production.com
Replace text: https://api.production.com
With text: http://localhost:3000
```

### Mock a Response

1. Open the Intercept workflow.
2. Create or edit an intercept rule with:
   - rule name
   - URL pattern
   - request method
   - HTTP status code
   - JSON response body
3. Save and enable the rule.
4. Trigger a matching request from the target page.

Example:

```json
{
  "name": "Mock user missing",
  "urlContains": "api.example.com/users/999",
  "method": "GET",
  "status": 404,
  "responseBody": {
    "error": "User not found",
    "code": "USER_NOT_FOUND"
  }
}
```

### Use an Isolated Session

1. Open the Session workflow.
2. Enter a session name and origin/URL.
3. Launch the isolated tab.
4. Use Activate to focus an existing isolated tab.
5. Use Rename, Close, or Delete to manage the runtime-backed session.

### Use Debug Tools

1. Open the Debug workflow.
2. Review summary totals and recent logs.
3. Use **Clear** to clear logs only.
4. Use **Export Config** to download a JSON snapshot.
5. Use **Import Config** to restore a valid JSON snapshot.
6. Use **Copy Status Summary** to copy current status/debug context.

## Development

### Current Architecture

Basuki v3 uses a Vite multi-entry build for a Chrome MV3 extension:

```text
basuki/
├── manifest.json              # Source MV3 manifest
├── popup.html                 # Popup HTML shell
├── vite.config.js             # Vite multi-entry extension build
├── src/
│   ├── background/            # MV3 service worker and runtime handlers
│   ├── content/               # Content bootstrap and injected intercept runtime
│   └── popup/
│       ├── adapters/          # React-to-Chrome storage/runtime adapters
│       ├── app/               # React popup shell and editors
│       ├── constants/         # Shared popup constants
│       ├── i18n/              # English/Indonesian dictionary and language store
│       ├── state/             # Initial snapshot and storage sync bridge
│       ├── styles/            # React popup CSS
│       └── assets/            # Popup image assets
├── images/                    # Extension icons
└── dist/                      # Generated extension bundle
```

### Build Commands

```bash
# Development build with source maps
pnpm run build:dev

# Production build
pnpm run build

# Watch mode
pnpm run watch
```

The build emits a loadable extension bundle to `dist/` with:

```text
dist/
├── manifest.json
├── popup.html
├── popup.js
├── background.js
├── content.js
├── intercept.js
├── isolation.js
├── chunks/
├── assets/
└── images/
```

### Development Workflow

1. Make changes under `src/`, `manifest.json`, `popup.html`, or `vite.config.js`.
2. Run `pnpm run build:dev`.
3. Reload Basuki in `chrome://extensions/`.
4. Inspect popup errors with **Inspect popup**.
5. Test redirect/intercept/session/debug workflows against a real page.

## Runtime Model

### Background Runtime

- Owns extension lifecycle and MV3 service worker behavior.
- Handles runtime messages from the popup.
- Manages session isolation and cookie operations.
- Updates extension icon state.

### Content Runtime

- Reads stored redirect/intercept configuration.
- Injects the page interceptor when enabled rules exist.
- Bridges runtime events/logs back into extension storage.

### Popup Runtime

- React UI rendered from `src/popup/app/main.jsx`.
- Uses adapter modules to preserve Chrome storage/message contracts.
- Synchronizes with `chrome.storage.local` through `src/popup/state/syncRuntime.js`.
- Supports bilingual EN/ID labels from `src/popup/i18n/dictionary.js`.

## Storage Keys

Basuki stores runtime data in `chrome.storage.local`:

```js
{
  apiRedirect: {
    configs: []
  },
  apiIntercept: {
    configs: []
  },
  sessionIsolation: {
    isolatedTabs: []
  },
  basukiLogs: []
}
```

## Verification

Before shipping changes, run:

```bash
pnpm run build:dev
pnpm run build
```

Then load `dist/` in Chrome and verify:

- Redirect create/edit/toggle/delete.
- Intercept create/edit/toggle/delete with JSON body validation.
- Session launch/activate/rename/close/delete.
- Debug summary, logs, clear logs, export/import, and Copy Status Summary.

## Troubleshooting

### Extension does not load

1. Run `pnpm run build`.
2. Load the generated `dist/` directory, not the repository root.
3. Check `chrome://extensions/` for manifest errors.
4. Inspect the popup console for React/runtime errors.

### Redirect or intercept does not apply

1. Confirm the rule is enabled.
2. Confirm the URL pattern matches the actual request URL.
3. Reload the target page after enabling the rule.
4. Open Debug and inspect logs/summary counts.

### Session isolation behaves unexpectedly

1. Confirm the session was launched from the Session workflow.
2. Use Activate to focus the isolated tab.
3. Close/delete stale sessions from the popup.
4. Reload the extension if Chrome has suspended/restarted the service worker.

## Contributing

1. Fork the repository.
2. Create a feature branch.
3. Make focused changes.
4. Run `pnpm run build:dev` and `pnpm run build`.
5. Load `dist/` in Chrome and manually verify affected workflows.
6. Submit a pull request.

## License

ISC License. See `LICENSE` for details.

## Links

- Repository: [github.com/zakyyudha/basuki](https://github.com/zakyyudha/basuki)
- Issues: [github.com/zakyyudha/basuki/issues](https://github.com/zakyyudha/basuki/issues)
- Releases: [github.com/zakyyudha/basuki/releases](https://github.com/zakyyudha/basuki/releases)
