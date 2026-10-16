import { describe, expect, it } from "vitest"
import { MIN_SEARCHES_SHOWN, normalizeTerm, summarize, type SearchStatRow } from "./marketplaceSearchStats"

const NOW = Date.UTC(2026, 9, 9)
const DAY = 24 * 60 * 60 * 1000

describe("normalizeTerm", () => {
  it("lowercases and tidies spaces", () => {
    expect(normalizeTerm("  Samsung   FRIDGE ")).toBe("samsung fridge")
  })
  it("rejects short or non-text input", () => {
    expect(normalizeTerm("ab")).toBeNull()
    expect(normalizeTerm(42)).toBeNull()
  })
  it("rejects emails and phone numbers", () => {
    expect(normalizeTerm("jo@example.com")).toBeNull()
    expect(normalizeTerm("0821234567")).toBeNull()
    expect(normalizeTerm("iphone 13")).toBe("iphone 13")
  })
})

describe("summarize", () => {
  const row = (term: string, daily: Record<string, number>, zeroResults = 0): SearchStatRow => ({
    term,
    count: Object.values(daily).reduce((a, b) => a + b, 0),
    zeroResults,
    daily,
    lastAt: NOW,
  })

  it("hides terms searched fewer than the minimum", () => {
    const rows = [row("rare", { "2026-10-09": MIN_SEARCHES_SHOWN - 1 })]
    expect(summarize(rows, 30, NOW)).toEqual([])
  })

  it("counts only days inside the window and sorts by searches", () => {
    const old = new Date(NOW - 40 * DAY).toISOString().slice(0, 10)
    const rows = [
      row("fridge", { "2026-10-09": 4, [old]: 50 }),
      row("chair", { "2026-10-08": 9 }),
    ]
    const out = summarize(rows, 30, NOW)
    expect(out.map((r) => [r.term, r.searches])).toEqual([
      ["chair", 9],
      ["fridge", 4],
    ])
  })

  it("exposes only term-level totals", () => {
    const out = summarize([row("fridge", { "2026-10-09": 5 }, 5)], 7, NOW)
    expect(Object.keys(out[0]).sort()).toEqual(["lastAt", "searches", "term", "zeroResults"])
    expect(out[0].zeroResults).toBe(5)
  })
})
