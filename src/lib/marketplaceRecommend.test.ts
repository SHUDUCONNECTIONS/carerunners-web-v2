import { describe, expect, it } from "vitest"
import { recommend } from "./marketplaceRecommend"

const NOW = Date.UTC(2026, 9, 9)
const DAY = 24 * 60 * 60 * 1000
const item = (id: string, title: string, category: string, description = "", createdAt = 0) => ({
  id,
  title,
  description,
  category,
  createdAt,
})

const items = [
  item("a", "Samsung fridge", "appliances"),
  item("b", "Kettle", "appliances", "works with the fridge shelf"),
  item("c", "Office chair", "furniture"),
  item("d", "Toaster", "appliances"),
]

describe("recommend", () => {
  it("returns nothing without searches", () => {
    expect(recommend(items, [], { now: NOW })).toEqual([])
  })

  it("returns nothing when no search matches any item", () => {
    expect(recommend(items, [{ term: "guitar", at: NOW }], { now: NOW })).toEqual([])
  })

  it("ranks title matches above description matches, then same-category items", () => {
    const ids = recommend(items, [{ term: "fridge", at: NOW }], { now: NOW }).map((i) => i.id)
    expect(ids).toEqual(["a", "b", "d"])
  })

  it("weights recent searches above old ones", () => {
    const ids = recommend(
      items,
      [
        { term: "chair", at: NOW },
        { term: "toaster", at: NOW - 60 * DAY },
      ],
      { now: NOW }
    ).map((i) => i.id)
    expect(ids[0]).toBe("c")
  })

  it("honours exclude and limit", () => {
    const ids = recommend(items, [{ term: "fridge", at: NOW }], {
      now: NOW,
      limit: 1,
      exclude: (i) => i.id === "a",
    }).map((i) => i.id)
    expect(ids).toEqual(["b"])
  })
})
