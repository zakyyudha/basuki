// Constants for configuration types and IDs
const CONFIG_KIND = {
  API_REDIRECT: 'apiRedirect',
  API_INTERCEPT: 'apiIntercept',
}

const VALUE_IDS = {
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

// Helper class for managing configuration operations
class ConfigManager {
  constructor (kind, valueIds) {
    this.kind = kind
    this.valueIds = valueIds
  }

  static getConfigs (kind, callback) {
    chrome.storage.local.get((result) => {
      const configs = result[kind] ? result[kind].configs : []
      callback({ configs })
    })
  }

  static saveConfigs (kind, configs, callback) {
    chrome.storage.local.set({ [kind]: { configs } }, callback)
  }

  static createConfig (payload) {
    return {
      ...payload,
      enabled: true,
      debug: false,
    }
  }

  clearInputs (elementIds) {
    elementIds.forEach(id => {
      document.getElementById(id).value = ''
    })
  }

  getElementValues () {
    const values = {}
    this.valueIds.forEach((id) => {
      values[id] = document.getElementById(id).value
    })
    return values
  }

  saveInput (buttonElementId, validatorCallback) {
    document.getElementById(buttonElementId).addEventListener('click', () => {
      const values = this.getElementValues()
      const { id } = values

      const { isValid, message } = validatorCallback(this.valueIds)
      if (!isValid) {
        alert(message)
        return
      }

      if (!id) {
        this.createNewConfig(values)
      } else {
        this.updateExistingConfig(id, values)
      }

      this.clearInputs(this.valueIds)
    })
  }

  createNewConfig (values) {
    const inputId = Date.now()
    ConfigManager.getConfigs(this.kind, (result) => {
      const configs = result.configs
      configs.push(ConfigManager.createConfig({ ...values, id: inputId }))
      ConfigManager.saveConfigs(this.kind, configs, () => {
        alert('Konfigurasi disimpan')
        this.loadConfigs() // Reload configurations
      })
    })
  }

  updateExistingConfig (id, values) {
    // Update the specific config using its ID
    this.updateConfig(this.kind, id, values)
    alert('Konfigurasi berhasil diperbarui')
  }

  loadConfigs () {
    ConfigManager.getConfigs(this.kind, (result) => {
      const configList = document.getElementById(
        this.kind === CONFIG_KIND.API_REDIRECT
          ? 'configList'
          : 'intercept-configList')
      configList.innerHTML = ''
      result.configs.forEach((config) => {
        const row = this.createConfigRow(config)
        configList.appendChild(row)
      })
    })
  }

  createConfigRow (config) {
    const row = document.createElement('tr')
    row.appendChild(
      this.createTextCell(config.configName || config.interceptConfigName))
    row.appendChild(this.createToggleCell(config.id, config.enabled,
      this.toggleConfig.bind(this)))
    row.appendChild(this.createToggleCell(config.id, config.debug,
      this.toggleDebug.bind(this)))
    row.appendChild(this.createActionsCell(config.id))
    return row
  }

  createTextCell (text) {
    const cell = document.createElement('td')
    cell.textContent = text
    return cell
  }

  createToggleCell (id, checked, toggleCallback) {
    const cell = document.createElement('td')
    const toggle = document.createElement('input')
    toggle.type = 'checkbox'
    toggle.checked = checked
    toggle.className = 'form-check-input'
    toggle.addEventListener('change',
      () => toggleCallback(this.kind, id, toggle.checked))
    cell.appendChild(toggle)
    return cell
  }

  createActionsCell (id) {
    const cell = document.createElement('td')

    const editButton = this.createButton('Edit', 'btn btn-primary btn-sm',
      () => {
        this.editConfig(id)
      })

    const deleteButton = this.createButton('Hapus', 'btn btn-danger btn-sm',
      () => {
        if (confirm('Apakah anda yakin ingin menghapus konfigurasi ini?')) {
          this.deleteConfig(id)
        }
      })

    cell.appendChild(editButton)
    cell.appendChild(document.createTextNode(' '))
    cell.appendChild(deleteButton)

    return cell
  }

  createButton (text, className, onClick) {
    const button = document.createElement('button')
    button.textContent = text
    button.className = className
    button.addEventListener('click', onClick)
    return button
  }

  editConfig (id) {
    ConfigManager.getConfigs(this.kind, (result) => {
      const config = result.configs.find(config => config.id === id)
      this.valueIds.forEach(id => {
        document.getElementById(id).value = config[id] || ''
        if (id === 'interceptRequestMethod') {
          const selectElement = document.getElementById(id)
          const options = selectElement.options
          for (let i = 0; i < options.length; i++) {
            if (options[i].value === config[id]) {
              options[i].selected = true
              break
            }
          }
        }
      })

      // Switch to the tab with the form
      document.getElementById(`${this.kind}-tabCreateConfiguration`).click()
    })
  }

  toggleConfig (kind, id, enabled) {
    this.updateConfig(kind, id, { enabled })
  }

  toggleDebug (kind, id, debug) {
    this.updateConfig(kind, id, { debug })
  }

  updateConfig (kind, id, updates) {
    delete updates.id
    ConfigManager.getConfigs(kind, (result) => {
      const configs = result.configs.map((config) =>
        config.id === Number(id) ? { ...config, ...updates } : config,
      )
      ConfigManager.saveConfigs(kind, configs, this.loadConfigs.bind(this))
    })
  }

  deleteConfig (id) {
    ConfigManager.getConfigs(this.kind, (result) => {
      const configs = result.configs.filter(config => config.id !== id)
      ConfigManager.saveConfigs(this.kind, configs,
        this.loadConfigs.bind(this))
    })
  }
}

// Validation functions remain unchanged
function getElementValue (ids) {
  const values = {}
  ids.forEach((id) => {
    values[id] = document.getElementById(id).value
  })
  return values
}

function validateRedirectForm () {
  const { configName, urlContains, replaceText, withText } = getElementValue(
    VALUE_IDS.API_REDIRECT)
  if (!configName || !urlContains || !replaceText || !withText) {
    return { isValid: false, message: 'Semua kolom harus diisi' }
  }
  return { isValid: true }
}

function validateInterceptForm () {
  const {
    interceptConfigName,
    interceptUrlContains,
    interceptHttpStatusCode,
    interceptRequestMethod,
    interceptResponseBody,
  } = getElementValue(VALUE_IDS.API_INTERCEPT)
  try {
    JSON.parse(interceptResponseBody)
  } catch {
    return { isValid: false, message: 'Response body harus berupa JSON' }
  }
  if (!interceptConfigName ||
    !interceptUrlContains ||
    !interceptHttpStatusCode ||
    !interceptRequestMethod ||
    !interceptResponseBody) {
    return { isValid: false, message: 'Semua kolom harus diisi' }
  }
  return { isValid: true }
}

document.getElementById('isolation-clearSessionIsolation').
  addEventListener('click', () => {
    chrome.storage.local.get((data) => {
      const sessionIsolation = data.sessionIsolation
      sessionIsolation.isolatedTabs = []
      sessionIsolation.removedCookies = []
      chrome.storage.local.set({ sessionIsolation }, () => {
        alert('Semua sesi terisolasi telah dihapus')
      })
    })
  })

// Load footer
function loadFooter () {
  const basukiVersion = chrome.runtime.getManifest().version
  document.querySelector('footer div span').innerHTML = `
      <a href="https://github.com/zakyyudha/basuki" target="_blank" style="text-decoration: none">
        <span class="text-body-secondary">&copy; Basuki (v${basukiVersion})</span>
      </a>
    `
}

// Initial setup
document.querySelectorAll('ul.nav-pills > li.nav-item > .nav-link').
  forEach((nav) => {
    nav.addEventListener('click', () => {
      const inputs = document.querySelectorAll('input')
      inputs.forEach((input) => {
        input.value = ''
      })
      const textAreas = document.querySelectorAll('textarea')
      textAreas.forEach((textArea) => {
        textArea.value = ''
      })
    })
  })

document.getElementById('interceptResponseBody').
  addEventListener('input', function () {
    const textArea = document.getElementById('interceptResponseBody')
    const json = textArea.value
    try {
      const parsed = JSON.parse(json)
      textArea.classList.remove('is-invalid')
      textArea.value = JSON.stringify(parsed, null, 2)
    } catch {
      textArea.classList.add('is-invalid')
    }
  })

// Load configurations
const apiRedirectManager = new ConfigManager(CONFIG_KIND.API_REDIRECT,
  VALUE_IDS.API_REDIRECT)
apiRedirectManager.loadConfigs()

const apiInterceptManager = new ConfigManager(CONFIG_KIND.API_INTERCEPT,
  VALUE_IDS.API_INTERCEPT)
apiInterceptManager.loadConfigs()

loadFooter()

apiRedirectManager.saveInput('save', validateRedirectForm)
apiInterceptManager.saveInput('intercept-save', validateInterceptForm)
