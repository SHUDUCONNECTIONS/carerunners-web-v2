// Items a buyer has saved for later. Kept in this browser (localStorage), so they don't follow the
// buyer to another device.
const KEY = "carerunners-market-saved"
const EVENT = "carerunners-market-saved-changed"

export function loadSaved(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]")
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []
  } catch {
    return []
  }
}

export function toggleSaved(listingId: string): string[] {
  const current = loadSaved()
  const next = current.includes(listingId) ? current.filter((id) => id !== listingId) : [...current, listingId].slice(-200)
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // storage blocked: nothing is saved
  }
  window.dispatchEvent(new Event(EVENT))
  return next
}

export function subscribeSaved(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}
