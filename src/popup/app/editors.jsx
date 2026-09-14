import React, { useState, useEffect, useRef } from 'react'
import { t } from '../i18n/dictionary.js'
import { removeDraft, saveDraft } from '../adapters/draftAdapter.js'
import { isValidJson, looksLikeJson, validateRedirectDestination, validateSessionOrigin } from '../utils/validation.js'
import { matchesRedirectConfig, matchesInterceptConfig } from '../../content/utils/configMatcher.js'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'ALL']

/* ── Confirm Dialog ─────────────────────────────────────────────────────── */
function useModalFocus(open, containerRef, onClose) {
  const previousFocusRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    if (!open) return
    previousFocusRef.current = document.activeElement
    const container = containerRef.current
    const getFocusable = () => [...container?.querySelectorAll('button, input, textarea, select, [tabindex]:not([tabindex="-1"])') || []]
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = getFocusable()
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    requestAnimationFrame(() => getFocusable()[0]?.focus())
    return () => {
      window.removeEventListener('keydown', onKey)
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus()
    }
  }, [open, containerRef])
}

export function ConfirmDialog({ lang, open, onConfirm, onCancel }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    if (!open) return
  }, [open])
  useModalFocus(open, dialogRef, onCancel)
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div ref={dialogRef} className="confirm-box" role="dialog" aria-modal="true" aria-labelledby="confirm-delete-title" aria-describedby="confirm-delete-desc" onClick={e => e.stopPropagation()}>
        <p className="confirm-box__tag">{t('delete', lang)}</p>
        <h3 id="confirm-delete-title" className="confirm-box__title">{t('confirm_delete_title', lang)}</h3>
        <p id="confirm-delete-desc" className="confirm-box__desc">{t('confirm_delete_desc', lang)}</p>
        <div className="confirm-box__actions">
          <button className="btn-edit" onClick={onCancel}>{t('cancel', lang)}</button>
          <button className="btn-confirm-delete" onClick={onConfirm}>{t('confirm_delete_yes', lang)}</button>
        </div>
      </div>
    </div>
  )
}

/* ── Modal Shell ────────────────────────────────────────────────────────── */
function ModalShell({ lang, title, isNew, onClose, onSave, onDelete, formError, children }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const dialogRef = useRef(null)
  const deleteRef = useRef(null)
  useModalFocus(!confirmOpen, dialogRef, onClose)
  return (
    <div ref={dialogRef} className="editor-overlay" role="dialog" aria-modal="true" aria-labelledby="editor-title">
      <header className="editor-header">
        <div>
          <p className="editor-header__tag">{isNew ? t('new_label', lang) : t('edit_label', lang)}</p>
           <h2 id="editor-title" className="editor-header__title">{title}</h2>
        </div>
         <button className="btn-edit" onClick={onClose} aria-label={t('close', lang)}>×</button>
      </header>
      <div className="editor-body">{children}</div>
      {formError && (
        <div className="editor-form-error"><p>{formError}</p></div>
      )}
      <footer className="editor-footer">
        {onDelete && !isNew
           ? <button ref={deleteRef} className="btn-delete" onClick={() => setConfirmOpen(true)}>{t('delete', lang)}</button>
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
         onCancel={() => { setConfirmOpen(false); requestAnimationFrame(() => deleteRef.current?.focus()) }}
        onConfirm={() => { setConfirmOpen(false); onDelete?.() }}
      />
    </div>
  )
}

/* ── Field wrapper ──────────────────────────────────────────────────────── */
function Field({ label, hint, error, children }) {
  const fieldId = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  const errorId = `${fieldId}-error`
  return (
    <label className="editor-field" htmlFor={fieldId}>
      <span className="editor-field__label">
        {label}{hint && <span className="editor-field__hint"> · {hint}</span>}
      </span>
      {React.cloneElement(children, { id: fieldId, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': error ? errorId : undefined })}
      {error && <span id={errorId} className="editor-field__error" role="alert">{error}</span>}
    </label>
  )
}

function PatternTester({ lang, kind, draft }) {
  const [url, setUrl] = useState('')
  const [method, setMethod] = useState('GET')
  const [tested, setTested] = useState(null)
  const test = () => setTested(kind === 'redirect'
    ? matchesRedirectConfig(url, { ...draft, enabled: true })
    : matchesInterceptConfig(url, method, { ...draft, enabled: true }))
  return <div className="pattern-tester">
    <div className="pattern-tester__head"><span>{t('pattern_test', lang)}</span><small>{t('pattern_test_hint', lang)}</small></div>
    <input className="editor-input" value={url} placeholder="https://api.example.com/v1" aria-label={t('pattern_test_url', lang)} onChange={event => { setUrl(event.target.value); setTested(null) }} />
    {kind === 'intercept' && <select className="editor-input" value={method} onChange={event => { setMethod(event.target.value); setTested(null) }}>{['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].map(item => <option key={item}>{item}</option>)}</select>}
    <button type="button" className="btn-edit" onClick={test}>{t('pattern_test_run', lang)}</button>
    {tested !== null && <strong className={tested ? 'pattern-tester__match' : 'pattern-tester__miss'}>{tested ? t('pattern_test_match', lang) : t('pattern_test_miss', lang)}</strong>}
  </div>
}

/* ── Redirect Editor ────────────────────────────────────────────────────── */
export function RedirectEditor({ lang, rule, isNew, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState(rule)
  const [errors, setErrors] = useState({})
  const mountedRef = useRef(false)
  useEffect(() => setDraft(rule), [rule])
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    saveDraft({ kind: 'redirect', id: rule.id, isNew, values: draft }).catch(() => {})
  }, [draft, isNew, rule.id])

  const handleSave = () => {
    const errs = {}
    if (!draft.name?.trim()) errs.name = t('err_required', lang)
    if (!draft.from?.trim()) errs.from = t('err_required', lang)
    if (!draft.to?.trim()) errs.to = t('err_required', lang)
    if (draft.to?.trim()) {
      const destination = validateRedirectDestination(draft.to)
      if (!destination.ok) errs.to = t(destination.error === 'protocol' ? 'err_protocol' : 'err_url', lang)
    }
    if (draft.from?.includes('*')) errs.from = t('err_wildcard', lang)
    if (Object.keys(errs).length) { setErrors(errs); requestAnimationFrame(() => document.querySelector('.editor-input.error')?.focus()); return }
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
      <Field label={t('field_from', lang)} hint={t('field_from_hint', lang)} error={errors.from}>
        <input className={`editor-input${errors.from ? ' error' : ''}`}
           value={draft.from || ''} maxLength={500} placeholder="api.example.com/v1"
          onChange={e => setDraft({ ...draft, from: e.target.value })} />
      </Field>
      <Field label={t('field_to', lang)} hint={t('field_to_hint', lang)} error={errors.to}>
        <input className={`editor-input${errors.to ? ' error' : ''}`}
          value={draft.to || ''} maxLength={500} placeholder="http://localhost:3000"
          onChange={e => setDraft({ ...draft, to: e.target.value })} />
      </Field>
      <PatternTester lang={lang} kind="redirect" draft={draft} />
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
  const bodyWarning = draft.body && looksLikeJson(draft.body) && !isValidJson(draft.body)
  const mountedRef = useRef(false)
  useEffect(() => setDraft(rule), [rule])
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    saveDraft({ kind: 'intercept', id: rule.id, isNew, values: draft }).catch(() => {})
  }, [draft, isNew, rule.id])

  const handleSave = () => {
    const errs = {}
    const method = (draft.method || '').toUpperCase()
    const status = Number(draft.status)
    if (!draft.name?.trim()) errs.name = t('err_required', lang)
    if (!METHODS.includes(method)) errs.method = t('err_required', lang)
    if (!draft.pattern?.trim()) errs.pattern = t('err_required', lang)
    if (draft.pattern?.includes('*')) errs.pattern = t('err_wildcard', lang)
    if (!Number.isInteger(status) || status < 100 || status > 599) errs.status = t('err_status_range', lang)
    if (Object.keys(errs).length) { setErrors(errs); requestAnimationFrame(() => document.querySelector('.editor-input.error')?.focus()); return }
    setErrors({})
    onSave({
      ...draft,
      name: draft.name.trim(),
      method: (draft.method || 'GET').toUpperCase(),
      pattern: draft.pattern.trim(),
      status: Number(draft.status),
      body: draft.body || '',
    })
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
      <Field label={t('field_method', lang)} error={errors.method}>
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
      <Field label={t('field_pattern', lang)} hint={t('field_pattern_hint', lang)} error={errors.pattern}>
        <input className={`editor-input${errors.pattern ? ' error' : ''}`}
          value={draft.pattern || ''} maxLength={500} placeholder="/api/v2/auth/status"
          onChange={e => setDraft({ ...draft, pattern: e.target.value })} />
      </Field>
      <PatternTester lang={lang} kind="intercept" draft={draft} />
      <Field label={t('field_status', lang)} error={errors.status}>
        <input type="number" min={100} max={599}
          className={`editor-input${errors.status ? ' error' : ''}`}
           value={draft.status ?? ''}
           onChange={e => setDraft({ ...draft, status: e.target.value })} />
      </Field>
       <Field label={t('field_body', lang)} hint={bodyWarning ? t('warn_json', lang) : t('field_body_hint', lang)} error={errors.body}>
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
  const mountedRef = useRef(false)
  useEffect(() => setDraft(session), [session])
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    saveDraft({ kind: 'session', id: session.id, isNew, values: draft }).catch(() => {})
  }, [draft, isNew, session.id])

  const handleSave = () => {
    const errs = {}
    if (!draft.name?.trim()) errs.name = t('err_required', lang)
    if (!draft.origin?.trim()) errs.origin = t('err_required', lang)
    if (draft.origin?.trim()) {
      const origin = validateSessionOrigin(draft.origin)
      if (!origin.ok) errs.origin = t(origin.error === 'protocol' ? 'err_protocol' : 'err_origin', lang)
    }
    if (Object.keys(errs).length) { setErrors(errs); requestAnimationFrame(() => document.querySelector('.editor-input.error')?.focus()); return }
    setErrors({})
    const origin = validateSessionOrigin(draft.origin)
    onSave({ ...draft, name: draft.name.trim(), origin: draft.origin.trim(), url: origin.value, userAgent: (draft.userAgent || '').trim() })
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
       <Field label={t('field_origin', lang)} hint={session.isolationId ? t('field_runtime_readonly', lang) : t('field_origin_hint', lang)} error={errors.origin}>
         <input className={`editor-input${errors.origin ? ' error' : ''}`}
           value={draft.origin || ''} maxLength={253} placeholder="app.example.com" readOnly={!!session.isolationId}
           onChange={e => setDraft({ ...draft, origin: e.target.value })} />
       </Field>
       <Field label={t('field_ua', lang)} hint={session.isolationId ? t('field_runtime_readonly', lang) : t('field_ua_hint', lang)}>
         <input className="editor-input"
           value={draft.userAgent || ''} maxLength={300} placeholder="Desktop/Chrome" readOnly={!!session.isolationId}
          onChange={e => setDraft({ ...draft, userAgent: e.target.value })} />
      </Field>
    </ModalShell>
  )
}
