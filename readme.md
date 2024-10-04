# Basuki API Redirector

**Basuki API Redirector** is a Chrome extension designed to help developers intercept and modify API requests in real time. This tool allows you to dynamically replace parts of URLs in API requests, making it ideal for debugging and local development environments where you want to redirect live API calls to a local server.

## Features
- Intercepts and modifies API requests (both `XMLHttpRequest` and `fetch`).
- Dynamically replace parts of the URL based on your configuration.
- Manage multiple configurations for different projects.
- Toggle configurations on/off via a user-friendly interface.
- Changes the extension icon based on the active state (enabled/disabled).

## Installation

1. **Clone or download the repository**:

   ```bash
   git clone https://github.com/zakyyudha/basuki.git
   ```

2. **Load the extension in Chrome**:

    1. Open Chrome and navigate to `chrome://extensions/`.
    2. Enable "Developer mode" by toggling the switch in the top-right corner.
    3. Click "Load unpacked" and select the folder where you cloned/downloaded the repository.

## Usage

1. **Configuring the extension**:
    - Click on the extension icon in Chrome to open the popup.
    - Add new configurations by specifying the following:
        - **Nama Konfigurasi**: A label for the configuration.
        - **Pranala Mengandung**: Part of the URL you want to match.
        - **Ubah**: The text you want to replace in the matched URL.
        - **Dengan**: The replacement text for the matched URL.

2. **Simpan**: After entering your configuration details, click the **Save** button.

3. **Interception in action**:
    - When the configuration is enabled and a matching URL is detected in API requests, the URL will be modified as per your configuration.
    - The extension works on all types of API requests including `XMLHttpRequest` and `fetch`.

4. **Toggle configurations**: You can enable/disable individual configurations from the list within the popup. The extension icon will update based on whether any configurations are active.

## Configuration Example

In the popup, you can create configurations like:

| Config Name  | URL Contains | Replace Text     | With Text       |
|--------------|--------------|------------------|-----------------|
| Project Name | `/api`       | `https://api.example.com/` | `http://localhost:3000/` |

This configuration will intercept any request containing `/api/` in the URL, and replace `https://api.example.com/` with `http://localhost:3000/`.

## Development

1. **Modify the source code**:
   If you want to modify or extend the functionality of the extension, simply edit the files in the repository and reload the unpacked extension in Chrome.

2. **Files to know**:
    - `popup.html`: The user interface for managing configurations.
    - `background.js`: The background script that manages extension logic.
    - `scripts/api-redirector.intercept.js`: The script injected into web pages to intercept API requests.
    - `manifest.json`: Configuration file for the extension.
