window.addEventListener('message', (event) => {
  if (event.source !== window || event.data.type !== 'BASUKI_CONFIG') {
    return
  }
})
