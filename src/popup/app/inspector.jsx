import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { getStoredLanguage } from '../i18n/languageStore.js'
import { t } from '../i18n/dictionary.js'

const KEY = 'basukiTraffic'

const css = `
:root{--obsidian:oklch(.13 .008 280);--charcoal:oklch(.17 .008 280);--panel:oklch(.21 .008 280);--panel-elevated:oklch(.24 .01 280);--hairline:oklch(1 0 0 / 9%);--foreground:oklch(.96 .005 270);--muted:oklch(.68 .015 270);--backlight:oklch(.82 .15 210);--danger:oklch(.82 .17 22);--ok:oklch(.78 .17 155)}
*{box-sizing:border-box}body{margin:0;background:var(--obsidian);color:var(--foreground);font:13px ui-sans-serif,system-ui,sans-serif}button,input{font:inherit}button{cursor:pointer;border:1px solid var(--hairline);border-radius:6px;background:var(--panel);color:var(--foreground);padding:8px 12px}button:hover{border-color:oklch(.82 .15 210 / 45%);color:var(--backlight)}button:focus-visible,input:focus-visible,summary:focus-visible{outline:2px solid var(--backlight);outline-offset:2px}main{max-width:1220px;margin:auto;padding:24px}h1{font-size:20px;margin:0 0 6px}p{color:var(--muted);line-height:1.5}.toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:16px 0}.toolbar input[type=text]{flex:1;min-width:220px;border:1px solid var(--hairline);border-radius:6px;background:var(--charcoal);color:var(--foreground);padding:9px 10px;font:13px ui-monospace,monospace}.toolbar label{display:flex;align-items:center;gap:6px;color:var(--muted);white-space:nowrap}.spacer{flex:1}.layout{display:grid;grid-template-columns:minmax(280px,420px) minmax(0,1fr);gap:16px}.traffic,.detail{min-width:0;overflow:hidden;border:1px solid var(--hairline);border-radius:8px;background:var(--charcoal)}.traffic{max-height:680px;overflow-y:auto}.row{display:block;width:100%;border:0;border-bottom:1px solid var(--hairline);border-radius:0;background:transparent;text-align:left;padding:12px}.row.selected{background:var(--panel-elevated)}.row:last-child{border:0}.meta{display:flex;justify-content:space-between;gap:8px;margin-bottom:6px;font:12px ui-monospace,monospace}.url{color:var(--muted);word-break:break-all;font:12px ui-monospace,monospace}.ok{color:var(--ok)}.bad{color:var(--danger)}.empty{color:var(--muted);padding:32px 20px;text-align:center}.detail{padding:16px;min-height:320px}.detail-title{display:flex;align-items:center;gap:10px;font:14px ui-monospace,monospace}.detail-title strong{font-size:18px}.detail-time{margin-left:auto;color:var(--muted)}.route-map{margin:16px 0;overflow:hidden;border:1px solid var(--hairline);border-radius:8px}.route-item{padding:10px 12px}.route-item--target{background:oklch(.78 .17 155 / 8%)}.route-label{display:block;margin-bottom:5px;color:var(--muted);font:10px ui-monospace,monospace;letter-spacing:.1em}.route-item code{display:block;color:var(--foreground);word-break:break-all;font:12px ui-monospace,monospace}.route-divider{padding:5px 12px;border-top:1px solid var(--hairline);border-bottom:1px solid var(--hairline);background:var(--panel);color:var(--muted);font:10px ui-monospace,monospace}.detail section{border-top:1px solid var(--hairline);padding:10px 0}.detail summary{cursor:pointer;color:var(--foreground);font-weight:600}.detail pre{overflow:auto;margin:10px 0 0;border:1px solid var(--hairline);border-radius:6px;background:var(--obsidian);color:var(--foreground);padding:10px;white-space:pre-wrap;word-break:break-word;font:12px/1.55 ui-monospace,monospace}.json-tree{margin-top:10px}.json-node{margin:4px 0}.json-key{color:var(--backlight);font:12px ui-monospace,monospace}.json-value{color:var(--foreground);margin-left:8px;font:12px ui-monospace,monospace}.json-count{color:var(--muted);font:11px ui-monospace,monospace}.copy-status{color:var(--ok);font:12px ui-monospace,monospace}.error{border:1px solid var(--danger);border-radius:6px;background:oklch(.68 .22 22 / 10%);color:var(--danger);padding:10px}.clear-status{min-height:18px;color:var(--muted);font-size:12px}@media(max-width:760px){main{padding:16px}.layout{grid-template-columns:1fr}.traffic{max-height:360px}.detail{min-height:0}}
`

function destinationLabel(value) {
  try {
    const url = new URL(value)
    return `${url.host}${url.pathname}${url.search}`
  } catch { return value || '—' }
}

function parseValue(value) {
  if (value == null || value === '') return null
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) } catch { return value }
}

function JsonNode({ label, value, depth = 0, expand = null }) {
  const composite = value !== null && typeof value === 'object'
  const size = composite ? Object.keys(value).length : 0
  const marker = Array.isArray(value) ? `[${size}]` : `{${size}}`
  if (!composite) {
    return <div className="json-line" style={{ paddingLeft: depth * 16 }}><span className="json-key">{label}</span><span className="json-value">{value === null ? 'null' : typeof value === 'string' ? JSON.stringify(value) : String(value)}</span></div>
  }
  return <details className="json-node" open={expand ?? depth < 1} style={{ marginLeft: depth * 16 }}><summary><span className="json-key">{label}</span> <span className="json-count">{marker}</span></summary><div>{Object.entries(value).map(([key, child]) => <JsonNode key={key} label={key} value={child} depth={depth + 1} expand={expand} />)}</div></details>
}

function PrettyValue({ value, expand }) {
  const parsed = parseValue(value)
  if (parsed === null) return <pre>—</pre>
  if (typeof parsed !== 'object') return <pre>{String(parsed)}</pre>
  return <div className="json-tree"><JsonNode label="root" value={parsed} expand={expand} /></div>
}

function DetailSection({ title, value, open = false, expand = null }) {
  return <section><details open={expand ?? open}><summary>{title}</summary><PrettyValue value={value} expand={expand} /></details></section>
}

function RouteMap({ source, destination, lang }) {
  return <div className="route-map"><div className="route-item"><span className="route-label">{t('inspector_from', lang)}</span><code>{source || '—'}</code></div><div className="route-divider">{t('inspector_redirected_to', lang)}</div><div className="route-item route-item--target"><span className="route-label">{t('inspector_to_local', lang)}</span><code>{destination || '—'}</code></div></div>
}

function toCurl(request) {
  const parts = [`curl -X ${request.method || 'GET'} '${request.localUrl}'`]
  Object.entries(request.requestHeaders || {}).forEach(([key, value]) => parts.push(`-H '${key}: ${value}'`))
  if (request.requestBody) parts.push(`--data '${String(request.requestBody).replace(/'/g, `'\\''`)}'`)
  return parts.join(' \\\n  ')
}

function timeLabel(timestamp, lang) {
  if (!Number.isFinite(timestamp)) return '—'
  return `${new Date(timestamp).toLocaleTimeString()} ${t('inspector_at', lang)}`
}

function Inspector() {
  const lang = getStoredLanguage()
  const [traffic, setTraffic] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [expand, setExpand] = useState(null)
  const [query, setQuery] = useState('')
  const [failedOnly, setFailedOnly] = useState(false)
  const [copied, setCopied] = useState('')
  const [error, setError] = useState('')
  const [clearStatus, setClearStatus] = useState('')

  const read = () => chrome.storage.local.get(KEY, data => {
    if (chrome.runtime.lastError) { setError(chrome.runtime.lastError.message); return }
    const next = Array.isArray(data[KEY]) ? data[KEY] : []
    setTraffic(next)
    setSelectedId(id => next.some(item => item.id === id) ? id : next[0]?.id || null)
  })

  useEffect(() => {
    read()
    const listener = (changes, area) => { if (area === 'local' && changes[KEY]) read() }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  const clear = () => {
    if (!window.confirm(t('inspector_confirm_clear', lang))) return
    chrome.storage.local.set({ [KEY]: [] }, () => {
      if (chrome.runtime.lastError) setError(chrome.runtime.lastError.message)
      else setClearStatus(t('inspector_cleared', lang))
    })
  }

  const copy = (label, text) => {
    navigator.clipboard.writeText(text ?? '').then(() => {
      setCopied(label)
      window.setTimeout(() => setCopied(''), 1400)
    }).catch(error => setError(error.message || t('inspector_copy_failed', lang)))
  }

  const queryValue = query.trim().toLowerCase()
  const shown = traffic.filter(item => (!failedOnly || !item.ok) && (!queryValue || (item.localUrl || '').toLowerCase().includes(queryValue) || (item.sourceUrl || '').toLowerCase().includes(queryValue)))
  const selected = traffic.find(item => item.id === selectedId)

  return <><style>{css}</style><main>
    <h1>{t('inspector_title', lang)}</h1>
    <p>{t('inspector_scope', lang)}</p>
    {error && <div className="error" role="alert">{error}</div>}
    <div className="toolbar"><input aria-label={t('inspector_filter', lang)} type="text" placeholder={t('inspector_filter', lang)} value={query} onChange={event => setQuery(event.target.value)} /><label><input type="checkbox" checked={failedOnly} onChange={event => setFailedOnly(event.target.checked)} />{t('inspector_failed_only', lang)}</label><button onClick={clear}>{t('inspector_clear', lang)}</button></div>
    <div className="clear-status" role="status">{clearStatus}</div>
    <div className="layout"><section className="traffic" aria-label={t('inspector_traffic', lang)}>{shown.length ? shown.map(item => <button className={`row${item.id === selectedId ? ' selected' : ''}`} key={item.id} onClick={() => setSelectedId(item.id)}><div className="meta"><span className={item.ok ? 'ok' : 'bad'}>{item.method} {item.status || 'ERR'}</span><span>{timeLabel(item.timestamp, lang)} · {item.durationMs ?? '-'} ms</span></div><div className="url" title={item.localUrl}>{destinationLabel(item.localUrl)}</div></button>) : <div className="empty">{traffic.length ? t('inspector_no_match', lang) : t('inspector_empty', lang)}</div>}</section>
      <section className="detail" aria-label={t('inspector_details', lang)}>{selected ? <React.Fragment key={`${selected.id}-${expand}`}><div className="detail-title"><span className={selected.ok ? 'ok' : 'bad'}>{selected.method}</span><strong>{selected.status || 'ERR'}</strong><span className="detail-time">{selected.durationMs ?? '—'} ms</span></div><RouteMap lang={lang} source={selected.sourceUrl} destination={selected.localUrl} /><div className="toolbar"><button onClick={() => setExpand(true)}>{t('inspector_expand', lang)}</button><button onClick={() => setExpand(false)}>{t('inspector_collapse', lang)}</button><button onClick={() => setExpand(null)}>{t('inspector_reset', lang)}</button><span className="spacer" /><button onClick={() => copy('url', selected.localUrl)}>{copied === 'url' ? t('inspector_copied', lang) : t('inspector_copy_url', lang)}</button><button onClick={() => copy('body', selected.responseBody)}>{copied === 'body' ? t('inspector_copied', lang) : t('inspector_copy_body', lang)}</button><button onClick={() => copy('curl', toCurl(selected))}>{copied === 'curl' ? t('inspector_copied', lang) : t('inspector_copy_curl', lang)}</button></div><DetailSection title={t('inspector_request_headers', lang)} value={selected.requestHeaders} expand={expand} /><DetailSection title={t('inspector_request_body', lang)} value={selected.requestBody} open expand={expand} /><DetailSection title={t('inspector_response_headers', lang)} value={selected.responseHeaders} expand={expand} /><DetailSection title={t('inspector_response_body', lang)} value={selected.responseBody} open expand={expand} /><DetailSection title={t('inspector_timing', lang)} value={{ timestamp: selected.timestamp, durationMs: selected.durationMs }} expand={expand} /></React.Fragment> : <div className="empty">{t('inspector_select', lang)}</div>}</section>
    </div>
  </main></>
}

createRoot(document.getElementById('inspectorRoot')).render(<Inspector />)
