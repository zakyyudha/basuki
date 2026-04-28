// Basuki Popup — bilingual dictionary (EN / ID)
// Keys mirror rework UI i18n.ts exactly

export const LANGS = [{ key: 'en', label: 'EN' }, { key: 'id', label: 'ID' }]
export const DEFAULT_LANG = 'en'

const dict = {
  // Header / system
  status_active:        { en: 'Active',        id: 'Aktif'          },
  status_paused:        { en: 'Paused',        id: 'Jeda'           },
  status_intercepting:  { en: 'Intercepting',  id: 'Mencegat'       },
  toggle_system:        { en: 'Toggle system', id: 'Alihkan sistem' },

  // Tabs
  tab_redirect:   { en: 'Redirect',   id: 'Alihkan' },
  tab_intercept:  { en: 'Intercept',  id: 'Cegat'   },
  tab_session:    { en: 'Session',    id: 'Sesi'     },
  tab_debug:      { en: 'Debug',      id: 'Debug'    },

  // Panels
  panel_redirects:  { en: 'Redirect Rules',      id: 'Aturan Pengalihan'  },
  panel_intercepts: { en: 'Mock Responses',       id: 'Respons Tiruan'     },
  panel_sessions:   { en: 'Isolated Sessions',    id: 'Sesi Terisolasi'    },
  panel_debug:      { en: 'Debug Console',        id: 'Konsol Debug'       },

  // Actions
  add_rule:     { en: '+ Add Rule',     id: '+ Tambah Aturan' },
  add_mock:     { en: '+ Add Mock',     id: '+ Tambah Tiruan' },
  add_session:  { en: '+ New Session',  id: '+ Sesi Baru'     },
  edit:         { en: 'Edit',           id: 'Sunting'          },
  delete:       { en: 'Delete',         id: 'Hapus'            },
  cancel:       { en: 'Cancel',         id: 'Batal'            },
  save:         { en: 'Save',           id: 'Simpan'           },
  close:        { en: 'Close',          id: 'Tutup'            },
  launch:       { en: 'Launch',         id: 'Buka'             },

  // Fields
  field_name:    { en: 'Name',                   id: 'Nama'                  },
  field_from:    { en: 'From',                   id: 'Dari'                  },
  field_to:      { en: 'To',                     id: 'Tujuan'                },
  field_method:  { en: 'Method',                 id: 'Metode'                },
  field_pattern: { en: 'Pattern',                id: 'Pola'                  },
  field_status:  { en: 'Status Code',            id: 'Kode Status'           },
  field_body:    { en: 'Response Body',          id: 'Isi Respons'           },
  field_origin:  { en: 'Origin',                 id: 'Asal'                  },
  field_ua:      { en: 'User-Agent',             id: 'User-Agent'            },
  field_clean:   { en: 'Clean Storage State',    id: 'Bersihkan Penyimpanan' },

  // Stats
  stat_rules:    { en: 'RULES',    id: 'ATURAN' },
  stat_sessions: { en: 'SESSIONS', id: 'SESI'   },
  stat_hits:     { en: 'HITS',     id: 'HIT'    },

  // Footer
  footer_quick_toggle: { en: 'Pause All', id: 'Jeda Semua'  },
  footer_quick_resume: { en: 'Resume',    id: 'Lanjutkan'   },

  // Debug
  debug_summary:           { en: 'Configuration Summary',  id: 'Ringkasan Konfigurasi'   },
  debug_logs:              { en: 'Verbose Logs',            id: 'Log Terperinci'           },
  debug_clear:             { en: 'Clear',                   id: 'Bersihkan'               },
  debug_import:            { en: 'Import Config',           id: 'Impor Konfigurasi'       },
  debug_export:            { en: 'Export Config',           id: 'Ekspor Konfigurasi'      },
  debug_no_logs:           { en: 'No log entries yet.',     id: 'Belum ada log.'           },
  debug_total_redirects:   { en: 'Redirects',               id: 'Pengalihan'              },
  debug_total_intercepts:  { en: 'Intercepts',              id: 'Intersepsi'              },
  debug_total_sessions:    { en: 'Sessions',                id: 'Sesi'                    },
  debug_active_redirects:  { en: 'Active Redirects',        id: 'Pengalihan Aktif'        },
  debug_active_intercepts: { en: 'Active Intercepts',       id: 'Intersepsi Aktif'        },
  debug_active_sessions:   { en: 'Active Sessions',         id: 'Sesi Aktif'              },
  debug_total_hits:        { en: 'Total Hits',              id: 'Total Hit'               },
  debug_system:            { en: 'System',                  id: 'Sistem'                  },

  // Bootstrap errors
  bootstrap_failed: { en: 'Popup failed to load', id: 'Popup gagal dimuat'   },
  bootstrap_retry:  { en: 'Retry',                id: 'Coba lagi'             },
}

export function t(key, lang) {
  const entry = dict[key]
  if (!entry) return key
  return entry[lang] ?? entry['en'] ?? key
}
