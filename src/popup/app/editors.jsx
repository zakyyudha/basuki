import React, { useState, useEffect } from 'react'
import { t } from '../i18n/dictionary.js'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'ALL']

/* ── Confirm Dialog ─────────────────────────────────────────────────────── */
export function ConfirmDialog({ lang, open, onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel, onConfirm])
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="confirm-box" onClick={e => e.stopPropagation()}>
        <p className="confirm-box__tag">{t('delete', lang)}</p>
        <h3 className="confirm-box__title">{t('confirm_delete_title', lang)}</h3>
        <p className="confirm-box__desc">{t('confirm_delete_desc', lang)}</p>
        <div className="confirm-box__actions">
          <button className="btn-edit" onClick={onCancel}>{t('cancel', lang)}</button>
          <button className="btn-confirm-delete" onClick={onConfirm} autoFocus>{t('confirm_delete_yes', lang)}</button>
        </div>
      </div>
    </div>
  )
}

/* ── Modal Shell ────────────────────────────────────────────────────────── */
function ModalShell({ lang, title, isNew, onClose, onSave, onDelete, formError, children }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  return (
    <div className="editor-overlay">
      <header className="editor-header">
        <div>
          <p className="editor-header__tag">{isNew ? t('new_label', lang) : t('edit_label', lang)}</p>
          <h2 className="editor-header__title">{title}</h2>
        </div>
        <button className="btn-edit" onClick={onClose} aria-label={t('close', lang)}>✕</button>
      </header>
      <div className="editor-body">{children}</div>
      {formError && (
        <div className="editor-form-error"><p>{formError}</p></div>
      )}
      <footer className="editor-footer">
        {onDelete && !isNew
          ? <button className="btn-delete" onClick={() => setConfirmOpen(true)}>{t('delete', lang)}</button>
          : <span />
        }
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-edit" onClick={onClose}>{t('cancel', lang)}</button>
          <button className="btn-save" onClick={onSave}>{t('save', lang)}</button>
        </div>
      </footer>
      <ConfirmDialog
        lang={lang}
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => { setConfirmOpen(false); onDelete?.() }}
      />
    </div>
  )
}

/* ── Field wrapper ──────────────────────────────────────────────────────── */
function Field({ label, hint, error, children }) {
  return (
    <label className="editor-field">
      <span className="editor-field__label">
        {label}{hint && <span className="editor-field__hint"> · {hint}</span>}
      </span>
      {children}
      {error && <span className="editor-field__error">{error}</span>}
    </label>
  )
}

/* ── Redirect Editor ────────────────────────────────────────────────────── */
export function RedirectEditor({ lang, rule, isNew, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState(rule)
  const [errors, setErrors] = useState({})
  useEffect(() => setDraft(rule), [rule])

  const handleSave = () => {
    const errs = {}
    if (!draft.name?.trim()) errs.name = t('err_required', lang)
    if (!draft.from?.trim()) errs.from = t('err_required', lang)
    if (!draft.to?.trim()) errs.to = t('err_required', lang)
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    onSave({ ...draft, name: draft.name.trim(), from: draft.from.trim(), to: draft.to.trim() })
  }

  return (
    <ModalShell lang={lang} title={t('panel_redirects', lang)} isNew={isNew}
      onClose={onClose} onSave={handleSave} onDelete={onDelete}
      formError={Object.keys(errors).length ? t('err_fix_form', lang) : undefined}
    >
      <Field label={t('field_name', lang)} error={errors.name}>
        <input className={`editor-input${errors.name ? ' error' : ''}`}
          value={draft.name || ''} maxLength={60} placeholder="My Redirect"
          onChange={e => setDraft({ ...draft, name: e.target.value })} />
      </Field>
      <Field label={t('field_from', lang)} hint="match URL or pattern" error={errors.from}>
        <input className={`editor-input${errors.from ? ' error' : ''}`}
          value={draft.from || ''} maxLength={500} placeholder="https://api.example.com/*"
          onChange={e => setDraft({ ...draft, from: e.target.value })} />
      </Field>
      <Field label={t('field_to', lang)} hint="redirect target" error={errors.to}>
        <input className={`editor-input${errors.to ? ' error' : ''}`}
          value={draft.to || ''} maxLength={500} placeholder="http://localhost:3000"
          onChange={e => setDraft({ ...draft, to: e.target.value })} />
      </Field>
      <label className="editor-checkbox">
        <input type="checkbox" checked={!!draft.enabled}
          onChange={e => setDraft({ ...draft, enabled: e.target.checked })} />
        <span>{t('enabled', lang)}</span>
      </label>
    </ModalShell>
  )
}

/* ── Intercept Editor ───────────────────────────────────────────────────── */
export function InterceptEditor({ lang, rule, isNew, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState(rule)
  const [errors, setErrors] = useState({})
  useEffect(() => setDraft(rule), [rule])

  const handleSave = () => {
    const errs = {}
    if (!draft.name?.trim()) errs.name = t('err_required', lang)
    if (!draft.pattern?.trim()) errs.pattern = t('err_required', lang)
    if (!draft.status || draft.status < 100 || draft.status > 599) errs.status = t('err_status_range', lang)
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    onSave({ ...draft, name: draft.name.trim(), pattern: draft.pattern.trim() })
  }

  return (
    <ModalShell lang={lang} title={t('panel_intercepts', lang)} isNew={isNew}
      onClose={onClose} onSave={handleSave} onDelete={onDelete}
      formError={Object.keys(errors).length ? t('err_fix_form', lang) : undefined}
    >
      <Field label={t('field_name', lang)} error={errors.name}>
        <input className={`editor-input${errors.name ? ' error' : ''}`}
          value={draft.name || ''} maxLength={60}
          onChange={e => setDraft({ ...draft, name: e.target.value })} />
      </Field>
      <Field label={t('field_method', lang)}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {METHODS.map(m => (
            <button key={m} type="button"
              onClick={() => setDraft({ ...draft, method: m })}
              className={draft.method === m ? 'method-btn active' : 'method-btn'}>
              {m}
            </button>
          ))}
        </div>
      </Field>
      <Field label={t('field_pattern', lang)} hint="URL or regex match" error={errors.pattern}>
        <input className={`editor-input${errors.pattern ? ' error' : ''}`}
          value={draft.pattern || ''} maxLength={500} placeholder="/api/v2/auth/status"
          onChange={e => setDraft({ ...draft, pattern: e.target.value })} />
      </Field>
      <Field label={t('field_status', lang)} error={errors.status}>
        <input type="number" min={100} max={599}
          className={`editor-input${errors.status ? ' error' : ''}`}
          value={draft.status || 200}
          onChange={e => setDraft({ ...draft, status: Number(e.target.value) || 0 })} />
      </Field>
      <Field label={t('field_body', lang)} hint="JSON or raw" error={errors.body}>
        <textarea className="editor-textarea"
          value={draft.body || ''} maxLength={20000} placeholder='{ "ok": true }'
          onChange={e => setDraft({ ...draft, body: e.target.value })} />
      </Field>
      <label className="editor-checkbox">
        <input type="checkbox" checked={!!draft.enabled}
          onChange={e => setDraft({ ...draft, enabled: e.target.checked })} />
        <span>{t('enabled', lang)}</span>
      </label>
    </ModalShell>
  )
}

/* ── Session Editor ─────────────────────────────────────────────────────── */
export function SessionEditor({ lang, session, isNew, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState(session)
  const [errors, setErrors] = useState({})
  useEffect(() => setDraft(session), [session])

  const handleSave = () => {
    const errs = {}
    if (!draft.name?.trim()) errs.name = t('err_required', lang)
    if (!draft.origin?.trim()) errs.origin = t('err_required', lang)
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    onSave({ ...draft, name: draft.name.trim(), origin: draft.origin.trim(), userAgent: (draft.userAgent || '').trim() })
  }

  return (
    <ModalShell lang={lang} title={t('panel_sessions', lang)} isNew={isNew}
      onClose={onClose} onSave={handleSave} onDelete={onDelete}
      formError={Object.keys(errors).length ? t('err_fix_form', lang) : undefined}
    >
      <Field label={t('field_name', lang)} error={errors.name}>
        <input className={`editor-input${errors.name ? ' error' : ''}`}
          value={draft.name || ''} maxLength={60}
          onChange={e => setDraft({ ...draft, name: e.target.value })} />
      </Field>
      <Field label={t('field_origin', lang)} error={errors.origin}>
        <input className={`editor-input${errors.origin ? ' error' : ''}`}
          value={draft.origin || ''} maxLength={253} placeholder="app.example.com"
          onChange={e => setDraft({ ...draft, origin: e.target.value })} />
      </Field>
      <Field label={t('field_ua', lang)}>
        <input className="editor-input"
          value={draft.userAgent || ''} maxLength={300} placeholder="Desktop/Chrome"
          onChange={e => setDraft({ ...draft, userAgent: e.target.value })} />
      </Field>
      <label className="editor-checkbox">
        <input type="checkbox" checked={!!draft.cleanState}
          onChange={e => setDraft({ ...draft, cleanState: e.target.checked })} />
        <span>{t('field_clean', lang)}</span>
      </label>
    </ModalShell>
  )
}
