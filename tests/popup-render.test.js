import assert from 'node:assert/strict'
import React from 'react'
import { createServer } from 'vite'
import { renderToStaticMarkup } from 'react-dom/server'

globalThis.chrome = { runtime: { getManifest: () => ({ version: '3.1.0' }) } }
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { RedirectEditor, InterceptEditor, SessionEditor } = await server.ssrLoadModule('/src/popup/app/editors.jsx')
  const { AppShell } = await server.ssrLoadModule('/src/popup/app/AppShell.jsx')
  const props = { lang: 'en', isNew: true, onSave() {}, onClose() {} }
  assert.match(renderToStaticMarkup(React.createElement(AppShell, { state: { redirects: [], intercepts: [], sessions: [] } })), /BASUKI/)
  assert.match(renderToStaticMarkup(React.createElement(RedirectEditor, { ...props, rule: { id: 1, from: '', to: '' } })), /Test pattern/)
  assert.match(renderToStaticMarkup(React.createElement(InterceptEditor, { ...props, rule: { id: 2, method: 'GET', body: '{broken' } })), /invalid JSON will be sent as raw text/)
  assert.match(renderToStaticMarkup(React.createElement(SessionEditor, { ...props, session: { id: 'preset', origin: 'example.com' } })), /example.com/)
  console.log('Popup and all editor render smoke checks passed')
} finally {
  await server.close()
}
