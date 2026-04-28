import { DEFAULT_LANG, LANGS } from './dictionary.js'

const LANGUAGE_STORAGE_KEY = 'basuki.popup.lang'

function isSupportedLanguage(value) {
  return LANGS.some((lang) => lang.key === value)
}

export function getStoredLanguage() {
  try {
    const value = globalThis?.localStorage?.getItem(LANGUAGE_STORAGE_KEY)
    if (isSupportedLanguage(value)) {
      return value
    }
  } catch (error) {
    console.warn('Basuki - Failed reading language from localStorage:', error)
  }

  return DEFAULT_LANG
}

export function setStoredLanguage(lang) {
  const next = isSupportedLanguage(lang) ? lang : DEFAULT_LANG

  try {
    globalThis?.localStorage?.setItem(LANGUAGE_STORAGE_KEY, next)
  } catch (error) {
    console.warn('Basuki - Failed writing language to localStorage:', error)
  }

  return next
}

export function getLanguageStorageKey() {
  return LANGUAGE_STORAGE_KEY
}
