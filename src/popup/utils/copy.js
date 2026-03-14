export const POPUP_COPY = {
  nav: {
    redirects: 'Pengalihan API (Redirects)',
    intercepts: 'Pemintas API (Intercepts)',
    sessions: 'Isolasi Sesi (Sessions)',
  },
  actions: {
    save: 'Simpan (Save)',
    edit: 'Ubah (Edit)',
    delete: 'Hapus (Delete)',
    cancel: 'Batal (Cancel)',
    activate: 'Aktifkan (Activate)',
    openTab: 'Buka Tab (Open Tab)',
    rename: 'Ubah Nama (Rename)',
    clearAll: 'Hapus Semua Sesi (Clear All Sessions)',
    createTab: 'Buat Tab (Create Tab)',
  },
  status: {
    active: 'Aktif (Active)',
    inactive: 'Tidak Aktif (Inactive)',
  },
  labels: {
    configName: 'Nama Konfigurasi (Configuration Name)',
    conditions: 'Kondisi (Condition)',
    replacement: 'Penggantian (Replacement)',
    method: 'Metode Request (Request Method)',
    responseBody: 'Body Respons (Response Body)',
    sessionName: 'Nama Sesi (Session Name)',
  },
  feedback: {
    configSaved: 'Konfigurasi disimpan (Configuration saved)',
    configUpdated: 'Konfigurasi berhasil diperbarui (Configuration updated)',
    saveErrorPrefix: 'Gagal menyimpan konfigurasi (Failed to save configuration): ',
  },
  validation: {
    requiredFields: 'Semua kolom wajib diisi (All fields are required)',
    jsonRequired: 'Body respons harus JSON valid (Response body must be valid JSON)',
  },
  confirmations: {
    deleteConfig: 'Yakin ingin menghapus konfigurasi ini? (Delete this configuration?)',
    deleteSession: 'Yakin ingin menghapus tab terisolasi ini? (Delete this isolated tab?)',
    clearSessions: 'Yakin ingin menghapus semua sesi terisolasi? Tab terisolasi akan ditutup. (Clear all isolated sessions? Isolated tabs will be closed.)',
  },
  sessions: {
    enterValidUrl: 'Silakan masukkan URL yang valid (Please enter a valid URL)',
    invalidUrlFormat: 'URL tidak valid. Gunakan format yang benar, contoh: https://example.com (Invalid URL format)',
    emptyName: 'Nama sesi tidak boleh kosong (Session name cannot be empty)',
    activateFailed: 'Gagal mengaktifkan tab (Failed to activate tab)',
    emptyState: 'Tidak ada tab terisolasi aktif saat ini. (No active isolated tabs right now.)',
  },
}

export function copyFrom (path, fallback = '') {
  const value = path.split('.').reduce((acc, key) => acc?.[key], POPUP_COPY)
  return typeof value === 'string' ? value : fallback
}
