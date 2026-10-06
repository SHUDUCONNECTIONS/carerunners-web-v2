import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, belowMinimum, deliveryCharge, parseSettings } from "@/lib/marketplaceSettings";

describe("marketplace settings", () => {
  it("starts with everything off", () => {
    expect(deliveryCharge(DEFAULT_SETTINGS, 1000, 488.5)).toEqual({ fee: 488.5, subsidy: 0, charged: 488.5 });
    expect(belowMinimum(DEFAULT_SETTINGS, 1)).toBe(false);
  });
  it("applies the minimum order", () => {
    const s = parseSettings({ minOrderAmount: 200 });
    expect(belowMinimum(s, 199.99)).toBe(true);
    expect(belowMinimum(s, 200)).toBe(false);
  });
  it("discounts delivery above the threshold, capped", () => {
    const s = parseSettings({ deliverySubsidyOver: 500, deliverySubsidyAmount: 150 });
    expect(deliveryCharge(s, 499, 300)).toEqual({ fee: 300, subsidy: 0, charged: 300 });
    expect(deliveryCharge(s, 500, 300)).toEqual({ fee: 300, subsidy: 150, charged: 150 });
    expect(deliveryCharge(s, 900, 80)).toEqual({ fee: 80, subsidy: 80, charged: 0 });
  });
  it("cleans bad input", () => {
    expect(parseSettings({ minOrderAmount: "abc", deliverySubsidyOver: -5, deliverySubsidyAmount: 12.345 })).toEqual({
      minOrderAmount: 0, deliverySubsidyOver: 0, deliverySubsidyAmount: 12.35,
    });
  });
});
