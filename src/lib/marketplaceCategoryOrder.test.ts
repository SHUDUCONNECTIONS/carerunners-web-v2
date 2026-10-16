import { describe, it, expect } from "vitest";
import { categoryRank, MARKET_CATEGORIES } from "./marketplace";

describe("categoryRank", () => {
  it("puts tech first and everyday items last", () => {
    expect(categoryRank("computers_phones")).toBeLessThan(categoryRank("electronics"));
    expect(categoryRank("electronics")).toBeLessThan(categoryRank("furniture"));
    expect(categoryRank("furniture")).toBeLessThan(categoryRank("home_kitchen"));
    expect(categoryRank("home_kitchen")).toBeLessThan(categoryRank("other"));
  });

  it("ranks every category and puts unknown ones last", () => {
    const ranks = MARKET_CATEGORIES.map((c) => categoryRank(c.id));
    expect(new Set(ranks).size).toBe(MARKET_CATEGORIES.length);
    expect(categoryRank("something-new")).toBeGreaterThan(Math.max(...ranks));
  });
});
