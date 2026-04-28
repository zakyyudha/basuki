export const LANGS = [
  { key: 'en', label: 'EN' },
  { key: 'id', label: 'ID' },
]

export const DEFAULT_LANG = 'en'

export const dictionary = {
  popup_title: { en: 'Basuki', id: 'Basuki' },
  popup_tagline: { en: 'Dev workflow control center', id: 'Pusat kontrol alur kerja dev' },
  popup_version: { en: 'v2.4.0', id: 'v2.4.0' },

  status_active: { en: 'Active', id: 'Aktif' },
  status_paused: { en: 'Paused', id: 'Jeda' },
  status_intercepting: { en: 'Intercepting', id: 'Mencegat' },

  tab_redirect: { en: 'Redirect', id: 'Alihkan' },
  tab_intercept: { en: 'Intercept', id: 'Cegat' },
  tab_session: { en: 'Session', id: 'Sesi' },
  tab_debug: { en: 'Debug', id: 'Debug' },

  panel_redirects: { en: 'Redirect Rules', id: 'Aturan Pengalihan' },
  panel_intercepts: { en: 'Mock Responses', id: 'Respons Tiruan' },
  panel_sessions: { en: 'Isolated Sessions', id: 'Sesi Terisolasi' },
  panel_debug: { en: 'Debug Toolkit', id: 'Toolkit Debug' },

  stat_rules: { en: 'RULES', id: 'ATURAN' },
  stat_sessions: { en: 'SESSIONS', id: 'SESI' },
  stat_hits: { en: 'HITS', id: 'HIT' },

  shell_live_label: { en: 'Runtime connected', id: 'Runtime terhubung' },
  shell_refresh: { en: 'Refresh', id: 'Muat Ulang' },
  shell_loading: { en: 'Hydrating runtime state…', id: 'Memuat state runtime…' },
  shell_empty: { en: 'No data yet', id: 'Belum ada data' },

  debug_storage_mode: { en: 'Storage mode', id: 'Mode penyimpanan' },
  debug_log_count: { en: 'Log entries', id: 'Jumlah log' },
  debug_last_sync: { en: 'Last sync', id: 'Sinkron terakhir' },

  bootstrap_failed_title: {
    en: 'Failed to initialize popup',
    id: 'Gagal memulai popup',
  },
  bootstrap_failed_message: {
    en: 'Please reopen popup or reload extension.',
    id: 'Silakan buka ulang popup atau muat ulang ekstensi.',
  },
}

export function t(key, lang = DEFAULT_LANG) {
  const row = dictionary[key]
  if (!row) {
    return key
  }

  return row[lang] || row[DEFAULT_LANG] || key
}
