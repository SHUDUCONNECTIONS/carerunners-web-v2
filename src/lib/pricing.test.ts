import { describe, it, expect } from "vitest";
import { calculatePrice, calculatePayout, PAYOUT_RATE } from "@/lib/pricing";

describe("calculatePrice", () => {
  it("charges the R25 base price for a distance of 1km or less, for every non-removal service", () => {
    for (const serviceType of ["parcel_delivery", "laundry", "legal_logistics"] as const) {
      expect(calculatePrice(serviceType, 1)).toBe(25);
      expect(calculatePrice(serviceType, 0.5)).toBe(25);
    }
  });

  it("adds R10/km beyond the first km, for every non-removal service", () => {
    for (const serviceType of ["parcel_delivery", "laundry", "legal_logistics"] as const) {
      expect(calculatePrice(serviceType, 5)).toBe(25 + 4 * 10);
    }
  });

  it("defaults to the legal_logistics base price when no service type is given", () => {
    expect(calculatePrice(null, 1)).toBe(25);
    expect(calculatePrice(undefined, 5)).toBe(25 + 4 * 10);
  });

  it("uses the R25 base for motorcycle/hatchback/sedan removal vehicles, same as every other service", () => {
    expect(calculatePrice("home_office_removal", 1, "motorcycle")).toBe(25);
    expect(calculatePrice("home_office_removal", 1, "hatchback")).toBe(25);
    expect(calculatePrice("home_office_removal", 1, "sedan")).toBe(25);
    expect(calculatePrice("home_office_removal", 5, "sedan")).toBe(25 + 4 * 10);
  });

  it("uses the higher R400 base for the half ton bakkie, plus R10/km beyond 1km", () => {
    expect(calculatePrice("home_office_removal", 1, "half_ton_bakkie")).toBe(400);
    expect(calculatePrice("home_office_removal", 5, "half_ton_bakkie")).toBe(400 + 4 * 10);
  });

  it("ignores vehicleType for services other than home_office_removal", () => {
    expect(calculatePrice("parcel_delivery", 5, "half_ton_bakkie")).toBe(25 + 4 * 10);
  });

  it("accepts distance as a string, matching how it's read off the booking form", () => {
    expect(calculatePrice("parcel_delivery", "5")).toBe(25 + 4 * 10);
  });
});

describe("calculatePayout", () => {
  it("pays out 70% of the trip price", () => {
    expect(PAYOUT_RATE).toBe(0.7);
    expect(calculatePayout(100)).toBe(70);
    expect(calculatePayout("42.00")).toBeCloseTo(29.4);
  });
});
