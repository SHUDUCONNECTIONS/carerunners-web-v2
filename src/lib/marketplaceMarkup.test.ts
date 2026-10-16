import { describe, it, expect } from "vitest";
import { MARKUP_RATE, priceWithMarkup } from "./marketplaceMarkup";

describe("priceWithMarkup", () => {
  it("adds 30% to the company price", () => {
    expect(MARKUP_RATE).toBe(0.3);
    expect(priceWithMarkup(100)).toEqual({ markupAmount: 30, sellingPrice: 130 });
    expect(priceWithMarkup(2000)).toEqual({ markupAmount: 600, sellingPrice: 2600 });
  });

  it("rounds to cents", () => {
    expect(priceWithMarkup(19.98)).toEqual({ markupAmount: 5.99, sellingPrice: 25.97 });
    expect(priceWithMarkup(33.33)).toEqual({ markupAmount: 10, sellingPrice: 43.33 });
  });
});
