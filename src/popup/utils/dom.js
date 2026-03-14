
import { copyFrom } from './copy.js'

export function clearInputs (elementIds) {
    elementIds.forEach(id => {
      document.getElementById(id).value = ''
    })
  }
  
  export function getElementValues (valueIds) {
    const values = {}
    valueIds.forEach((id) => {
      values[id] = document.getElementById(id).value
    })
    return values
  }
  
  export function createTextCell (text) {
    const cell = document.createElement('td')
    cell.textContent = text
    return cell
  }
  
  export function createToggleCell (id, checked, toggleCallback, type = 'enabled') {
    const cell = document.createElement('td')
    const toggle = document.createElement('input')
    toggle.type = 'checkbox'
    toggle.checked = checked
    toggle.className = 'form-check-input'
    toggle.addEventListener('change',
      () => toggleCallback(id, toggle.checked, type))
    cell.appendChild(toggle)
    return cell
  }
  
  export function createButton (text, className, onClick) {
    const button = document.createElement('button')
    button.textContent = text
    button.className = className
    button.addEventListener('click', onClick)
    return button
  }
  
export function createActionsCell (id, editCallback, deleteCallback) {
  const cell = document.createElement('td')
  const wrapper = document.createElement('div')
  wrapper.className = 'row-actions'

  const editButton = createButton(copyFrom('actions.edit'),
    'btn btn-sm action-btn action-btn--primary',
    () => {
      editCallback(id)
    })

  const deleteButton = createButton(copyFrom('actions.delete'),
    'btn btn-sm action-btn action-btn--danger',
    () => {
      if (confirm(copyFrom('confirmations.deleteConfig'))) {
        deleteCallback(id)
      }
    })

  wrapper.appendChild(editButton)
  wrapper.appendChild(deleteButton)
  cell.appendChild(wrapper)

  return cell
}
  
  export function loadFooter () {
    const basukiVersion = chrome.runtime.getManifest().version
    document.querySelector('footer div span').innerHTML = `
        <a href=https://github.com/zakyyudha/basuki target=_blank style=text-decoration: none>
          <span class=text-body-secondary>&copy; Basuki (v${basukiVersion})</span>
        </a>
      `
  }
  
  export function setupTabChangeEvent () {
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
  }
  
  export function setupInterceptResponseBodyFormatter () {
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
  }
  
