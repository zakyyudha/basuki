// Generalized function to update storage
export function updateStorage (data, logMessage = 'Cookies saved to chrome storage') {
  chrome.storage.local.set(data, () => console.log(data, logMessage))
}

// Generalized function to get data from storage
export async function getStorageData (keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve)
  })
}
