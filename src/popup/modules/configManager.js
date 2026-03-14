import { getStorageData, updateStorage } from '../utils/storage.js'
import {
  validateRedirectForm,
  validateInterceptForm,
} from '../utils/validation.js'

// Constants for configuration types and IDs
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

// Helper class for managing configuration operations
export class ConfigManager {
  constructor (kind, valueIds) {
    this.kind = kind
    this.valueIds = valueIds
  }

  static async getConfigs (kind) {
    const result = await getStorageData(kind)
    return result[kind] ? result[kind].configs : []
  }

  static async saveConfigs (kind, configs) {
    await updateStorage({ [kind]: { configs } })
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
    document.getElementById(buttonElementId).addEventListener('click', async () => {
      console.log('Basuki - Save button clicked')

      try {
        const values = this.getElementValues()
        console.log('Basuki - Form values:', values)
        const { id } = values

        const { isValid, message } = validatorCallback()
        console.log('Basuki - Validation result:', { isValid, message })

        if (!isValid) {
          alert(message)
          return
        }

        if (!id) {
          console.log('Basuki - Creating new config')
          await this.createNewConfig(values)
        } else {
          console.log('Basuki - Updating existing config:', id)
          await this.updateExistingConfig(id, values)
        }

        this.clearInputs(this.valueIds)
        console.log('Basuki - Save completed successfully')
      } catch (error) {
        console.error('Basuki - Save error:', error)
        alert('Error saving configuration: ' + error.message)
      }
    })
  }

  async createNewConfig (values) {
    try {
      console.log('Basuki - createNewConfig called with:', values)
      const inputId = Date.now()
      const configs = await ConfigManager.getConfigs(this.kind)
      console.log('Basuki - Existing configs:', configs)

      const newConfig = ConfigManager.createConfig({ ...values, id: inputId })
      console.log('Basuki - New config created:', newConfig)

      configs.push(newConfig)
      console.log('Basuki - Saving configs:', configs)

      await ConfigManager.saveConfigs(this.kind, configs)
      console.log('Basuki - Configs saved to storage')

      alert('Konfigurasi disimpan')
      this.loadConfigs() // Reload configurations
    } catch (error) {
      console.error('Basuki - createNewConfig error:', error)
      throw error
    }
  }

  async updateExistingConfig (id, values) {
    // Update the specific config using its ID
    await this.updateConfig(this.kind, id, values)
    alert('Konfigurasi berhasil diperbarui')
  }

  async loadConfigs () {
    const configs = await ConfigManager.getConfigs(this.kind)
    const configList = document.getElementById(
      this.kind === CONFIG_KIND.API_REDIRECT
        ? 'configList'
        : 'intercept-configList')
    configList.innerHTML = ''
    configs.forEach((config) => {
      const row = this.createConfigRow(config)
      configList.appendChild(row)
    })
  }

  createConfigRow (config) {
    const row = document.createElement('tr')
    row.className = 'workflow-row'
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
    cell.className = 'text-center'
    const toggle = document.createElement('input')
    toggle.type = 'checkbox'
    toggle.checked = checked
    toggle.className = 'form-check-input mt-0'
    toggle.addEventListener('change',
      () => toggleCallback(this.kind, id, toggle.checked))
    cell.appendChild(toggle)
    return cell
  }

  createActionsCell (id) {
    const cell = document.createElement('td')
    const wrapper = document.createElement('div')
    wrapper.className = 'row-actions'

    const editButton = this.createButton('Edit', 'btn btn-sm action-btn action-btn--primary',
      () => {
        this.editConfig(id)
      })

    const deleteButton = this.createButton('Hapus', 'btn btn-sm action-btn action-btn--danger',
      () => {
        if (confirm('Apakah anda yakin ingin menghapus konfigurasi ini?')) {
          this.deleteConfig(id)
        }
      })

    wrapper.appendChild(editButton)
    wrapper.appendChild(deleteButton)
    cell.appendChild(wrapper)

    return cell
  }

  createButton (text, className, onClick) {
    const button = document.createElement('button')
    button.textContent = text
    button.className = className
    button.addEventListener('click', onClick)
    return button
  }

  async editConfig (id) {
    const configs = await ConfigManager.getConfigs(this.kind)
    const config = configs.find(config => config.id === id)
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
    const tabId = this.kind === CONFIG_KIND.API_REDIRECT
      ? 'apiRedirect-tabCreateConfiguration'
      : 'apiIntercept-tabCreateConfiguration'
    document.getElementById(tabId).click()
  }

  async toggleConfig (kind, id, enabled) {
    await this.updateConfig(kind, id, { enabled })
  }

  async toggleDebug (kind, id, debug) {
    await this.updateConfig(kind, id, { debug })
  }

  async updateConfig (kind, id, updates) {
    delete updates.id
    const configs = await ConfigManager.getConfigs(kind)
    const updatedConfigs = configs.map((config) =>
      config.id === Number(id) ? { ...config, ...updates } : config,
    )
    await ConfigManager.saveConfigs(kind, updatedConfigs)
    this.loadConfigs()
  }

  async deleteConfig (id) {
    const configs = await ConfigManager.getConfigs(this.kind)
    const updatedConfigs = configs.filter(config => config.id !== id)
    await ConfigManager.saveConfigs(this.kind, updatedConfigs)
    this.loadConfigs()
  }
}
