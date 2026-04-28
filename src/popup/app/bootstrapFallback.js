export function renderBootstrapFallback(rootElement, options = {}) {
  if (!rootElement) {
    return
  }

  const title = options.title || 'Failed to initialize popup'
  const message =
    options.message ||
    'Failed to initialize popup. Please reopen or reload extension.'

  rootElement.innerHTML = `
    <section class="popup-fallback" role="alert" aria-live="assertive">
      <div class="popup-fallback__badge">Basuki</div>
      <h1 class="popup-fallback__title">${escapeHtml(title)}</h1>
      <p class="popup-fallback__message">${escapeHtml(message)}</p>
    </section>
  `
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
