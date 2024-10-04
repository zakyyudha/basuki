// Switch between tabs
document.getElementById('tab-form').addEventListener('click', function () {
  document.getElementById('formContent').classList.add('active')
  document.getElementById('configsContent').classList.remove('active')
  this.classList.add('active')
  document.getElementById('tab-configs').classList.remove('active')
})

document.getElementById('tab-configs').addEventListener('click', function () {
  document.getElementById('formContent').classList.remove('active')
  document.getElementById('configsContent').classList.add('active')
  this.classList.add('active')
  document.getElementById('tab-form').classList.remove('active')
})

// Save new configuration
document.getElementById('save').addEventListener('click', function () {
  const configName = document.getElementById('configName').value
  const urlContains = document.getElementById('urlContains').value
  const replaceText = document.getElementById('replaceText').value
  const withText = document.getElementById('withText').value
  const id = Date.now() // unique id for each config

  if (!configName || !urlContains || !replaceText || !withText) {
    alert('Mohon isi semua kolom')
    return
  }

  chrome.storage.sync.get({ configs: [] }, (result) => {
    const configs = result.configs
    configs.push({
      id,
      name: configName,
      urlContains,
      replaceText,
      withText,
      enabled: true, // default to enabled
      debug: false, // default to disabled
    })
    chrome.storage.sync.set({ configs }, () => {
      alert('Konfigurasi disimpan')
      loadConfigs()
    })
  })

  // Clear inputs after saving
  document.getElementById('configName').value = ''
  document.getElementById('urlContains').value = ''
  document.getElementById('replaceText').value = ''
  document.getElementById('withText').value = ''
})

// Load configurations
function loadConfigs () {
  chrome.storage.sync.get({ configs: [] }, (result) => {
    const basukiVersion = chrome.runtime.getManifest().version
    document.querySelector(
      'footer p').innerHTML = `
    <p style="font-size: 12px; text-align: center; margin-top: 20px;">&copy; ${new Date().getFullYear()} v${basukiVersion} <a
            href="https://github.com/zakyyudha/basuki" target="_blank">GitHub</a></p>`

    const configList = document.getElementById('configList')
    configList.innerHTML = ''

    result.configs.forEach((config) => {
      const row = document.createElement('tr')

      // Config Name (URL contains)
      const nameCell = document.createElement('td')
      nameCell.textContent = config.name
      row.appendChild(nameCell)

      // Toggle Enabled/Disabled
      const toggleCell = document.createElement('td')
      const toggle = document.createElement('input')
      toggle.type = 'checkbox'
      toggle.checked = config.enabled
      toggle.addEventListener('change',
        () => toggleConfig(config.id, toggle.checked))
      toggleCell.appendChild(toggle)
      row.appendChild(toggleCell)

      // Toggle Debug Enabled/Disabled
      const debugCell = document.createElement('td')
      const debug = document.createElement('input')
      debug.type = 'checkbox'
      debug.checked = config.debug
      debug.addEventListener('change',
        () => toggleDebug(config.id, debug.checked))
      debugCell.appendChild(debug)
      row.appendChild(debugCell)

      // Actions (Delete)
      const actionsCell = document.createElement('td')
      const deleteButton = document.createElement('button')
      deleteButton.textContent = 'Hapus'
      deleteButton.className = 'btn-delete'
      deleteButton.addEventListener('click', () => {
        if (confirm('Apakah anda yakin ingin menghapus konfigurasi ini?')) {
          deleteConfig(config.id)
        }
      })
      actionsCell.appendChild(deleteButton)
      row.appendChild(actionsCell)

      configList.appendChild(row)
    })
  })
}

// Toggle config enabled/disabled
function toggleConfig (id, enabled) {
  chrome.storage.sync.get({ configs: [] }, (result) => {
    const configs = result.configs.map((config) =>
      config.id === id ? { ...config, enabled } : config,
    )
    chrome.storage.sync.set({ configs }, loadConfigs)
  })
}

// Toggle config debug enabled/disabled
function toggleDebug (id, debug) {
  chrome.storage.sync.get({ configs: [] }, (result) => {
    const configs = result.configs.map((config) =>
      config.id === id ? { ...config, debug } : config,
    )
    chrome.storage.sync.set({ configs }, loadConfigs)
  })
}

// Delete a configuration
function deleteConfig (id) {
  chrome.storage.sync.get({ configs: [] }, (result) => {
    const configs = result.configs.filter((config) => config.id !== id)
    chrome.storage.sync.set({ configs }, loadConfigs)
  })
}

// Initial load of configurations
loadConfigs()
