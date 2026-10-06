import { describe, expect, it } from "vitest";
import { validateChange } from "@/lib/marketplaceBulk";

describe("validateChange", () => {
  it("accepts price, markup and stock", () => {
    expect(validateChange({ id: "a", companyPrice: "12.345", markup: 2, stock: 40 })).toEqual({ change: { id: "a", companyPrice: 12.35, markup: 2, stock: 40 } });
  });
  it("accepts a change that only touches stock", () => {
    expect(validateChange({ id: "a", stock: 0 })).toEqual({ change: { id: "a", stock: 0 } });
  });
  it("refuses bad values", () => {
    for (const bad of [{ id: "" }, { id: "a", companyPrice: 0 }, { id: "a", companyPrice: -3 }, { id: "a", markup: -1 }, { id: "a", stock: 1.5 }, { id: "a", stock: -1 }, null]) {
      expect("error" in validateChange(bad)).toBe(true);
    }
  });
});
