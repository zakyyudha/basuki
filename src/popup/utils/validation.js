import { VALUE_IDS } from './constants.js'
import { copyFrom } from './copy.js'

function getElementValue (ids) {
  const values = {}
  ids.forEach((id) => {
    const element = document.getElementById(id)
    if (element) {
      values[id] = element.value.trim()
    } else {
      console.error(`Element with ID ${id} not found`)
      values[id] = ''
    }
  })
  return values
}

export function validateRedirectForm () {
  const values = getElementValue(VALUE_IDS.API_REDIRECT)
  const { configName, urlContains, replaceText, withText } = values
  
  if (!configName || !urlContains || !replaceText || !withText) {
    return { isValid: false, message: copyFrom('validation.requiredFields') }
  }
  return { isValid: true }
}

export function validateInterceptForm () {
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
    return { isValid: false, message: copyFrom('validation.jsonRequired') }
  }
  if (!interceptConfigName ||
    !interceptUrlContains ||
    !interceptHttpStatusCode ||
    !interceptRequestMethod ||
    !interceptResponseBody) {
    return { isValid: false, message: copyFrom('validation.requiredFields') }
  }
  return { isValid: true }
}
