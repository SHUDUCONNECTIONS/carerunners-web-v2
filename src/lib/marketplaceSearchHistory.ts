// What a buyer has searched for, used to suggest items they may like. Kept in this browser
// (localStorage) only, so nothing about their searches is stored on our servers.
const KEY = "carerunners-market-searches"
const EVENT = "carerunners-market-searches-changed"
const MAX_SEARCHES = 20

export type SearchEntry = { term: string; at: number }

export function loadSearches(): SearchEntry[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]")
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x) => x && typeof x.term === "string" && typeof x.at === "number")
  } catch {
    return []
  }
}

function save(entries: SearchEntry[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries))
  } catch {
    // storage blocked: searches are simply not remembered
  }
  window.dispatchEvent(new Event(EVENT))
}

// Newest first, one entry per term, and very short terms (half-typed words) are ignored.
export function recordSearch(raw: string, now = Date.now()): void {
  const term = raw.trim().toLowerCase().replace(/\s+/g, " ")
  if (term.length < 3) return
  const rest = loadSearches().filter((e) => e.term !== term)
  save([{ term, at: now }, ...rest].slice(0, MAX_SEARCHES))
}

export function clearSearches(): void {
  save([])
}

export function subscribeSearches(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}
