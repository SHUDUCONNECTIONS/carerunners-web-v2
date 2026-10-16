import type { SearchEntry } from "./marketplaceSearchHistory"

// Minimal shape needed, so this stays easy to test.
type Item = { id: string; title: string; description: string; category: string; createdAt: number }

const DAY = 24 * 60 * 60 * 1000
// A search from a month ago still counts, but for much less than one from today.
const HALF_LIFE_DAYS = 14

function recency(at: number, now: number): number {
  const days = Math.max(0, (now - at) / DAY)
  return Math.pow(0.5, days / HALF_LIFE_DAYS)
}

// Ranks items by how well they fit the buyer's past searches:
//  - words found in the title count most, in the description less
//  - items in the same category as the items they searched for get a smaller boost
// Items that match nothing are never recommended. `exclude` hides items already shown
// elsewhere (e.g. saved ones).
export function recommend<T extends Item>(
  items: T[],
  searches: SearchEntry[],
  opts: { now?: number; limit?: number; exclude?: (item: T) => boolean } = {}
): T[] {
  const { now = Date.now(), limit = 8, exclude } = opts
  if (searches.length === 0) return []

  const queries = searches.map((s) => ({
    terms: s.term.split(" ").filter((t) => t.length >= 3),
    weight: recency(s.at, now),
  }))

  const direct = new Map<string, number>()
  const categoryWeight = new Map<string, number>()
  for (const item of items) {
    const title = item.title.toLowerCase()
    const body = item.description.toLowerCase()
    let score = 0
    for (const q of queries) {
      if (q.terms.length === 0) continue
      let hit = 0
      for (const t of q.terms) hit += title.includes(t) ? 3 : body.includes(t) ? 1 : 0
      score += (hit / q.terms.length) * q.weight
    }
    if (score > 0) {
      direct.set(item.id, score)
      categoryWeight.set(item.category, (categoryWeight.get(item.category) ?? 0) + score)
    }
  }
  if (direct.size === 0) return []

  const topCategory = Math.max(...categoryWeight.values())
  const scored = items
    .filter((item) => !exclude?.(item))
    .map((item) => {
      const d = direct.get(item.id) ?? 0
      // Up to 1 point for sitting in a category the buyer's searches keep landing in.
      const c = d > 0 ? 0 : (categoryWeight.get(item.category) ?? 0) / topCategory
      return { item, score: d + c }
    })
    .filter((x) => x.score > 0)

  scored.sort((a, b) => b.score - a.score || b.item.createdAt - a.item.createdAt)
  return scored.slice(0, limit).map((x) => x.item)
}
