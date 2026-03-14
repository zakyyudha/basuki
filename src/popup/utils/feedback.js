const FEEDBACK_VARIANTS = ['success', 'error', 'info']

export function createFeedbackController (elementId = 'popupFeedback') {
  const feedbackNode = document.getElementById(elementId)
  let clearTimer = null

  if (!feedbackNode) {
    return {
      show: () => {},
      clear: () => {},
    }
  }

  const clear = () => {
    if (clearTimer) {
      clearTimeout(clearTimer)
      clearTimer = null
    }
    feedbackNode.textContent = ''
    feedbackNode.hidden = true
    feedbackNode.classList.remove(
      'popup-shell__feedback--success',
      'popup-shell__feedback--error',
      'popup-shell__feedback--info',
    )
  }

  const show = (message, variant = 'info', timeoutMs = 2600) => {
    const resolvedVariant = FEEDBACK_VARIANTS.includes(variant) ? variant : 'info'
    clear()
    feedbackNode.hidden = false
    feedbackNode.textContent = message
    feedbackNode.classList.add(`popup-shell__feedback--${resolvedVariant}`)
    if (timeoutMs > 0) {
      clearTimer = setTimeout(() => {
        clear()
      }, timeoutMs)
    }
  }

  return { show, clear }
}
