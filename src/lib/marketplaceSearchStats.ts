// What buyers search for, counted per search term for the admin. Nothing about the buyer is stored
// with a search (no user id, email, device or IP): only the term, how many times it was searched,
// and how often it found nothing.
export const SEARCHES_COLLECTION = "marketplaceSearches"
export const MAX_TERM_LENGTH = 60
// A term must be searched this many times before the admin sees it, so a one-off search that
// happens to contain something personal (someone typing their own name) is never shown.
export const MIN_SEARCHES_SHOWN = 3

// Tidies a typed search into the term we count. Returns null when it shouldn't be recorded:
// too short, or it looks like personal details (an email address or a phone number).
export function normalizeTerm(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const term = raw.trim().toLowerCase().replace(/\s+/g, " ").slice(0, MAX_TERM_LENGTH)
  if (term.length < 3) return null
  if (term.includes("@")) return null
  if ((term.match(/\d/g) ?? []).length >= 7) return null
  return term
}

// "2026-10-09" in UTC, the key for one day's count.
export function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export type SearchStatRow = {
  term: string
  count: number
  zeroResults: number
  daily: Record<string, number>
  lastAt: number
}

export type SearchSummary = { term: string; searches: number; zeroResults: number; lastAt: number }

// Totals per term over the last `days` days, most searched first. Terms searched fewer than
// MIN_SEARCHES_SHOWN times in the window are left out.
export function summarize(rows: SearchStatRow[], days: number, now = Date.now()): SearchSummary[] {
  const since = dayKey(now - (days - 1) * 24 * 60 * 60 * 1000)
  const out: SearchSummary[] = []
  for (const r of rows) {
    let searches = 0
    for (const [day, n] of Object.entries(r.daily)) if (day >= since) searches += n
    if (searches < MIN_SEARCHES_SHOWN) continue
    // Zero-result counts are an all-time total, so scale to the window by share of searches.
    const zeroResults = r.count > 0 ? Math.min(searches, Math.round((r.zeroResults * searches) / r.count)) : 0
    out.push({ term: r.term, searches, zeroResults, lastAt: r.lastAt })
  }
  return out.sort((a, b) => b.searches - a.searches || b.lastAt - a.lastAt)
}
