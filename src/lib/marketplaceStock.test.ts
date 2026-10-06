import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { isListingAvailable } from "@/lib/marketplace";
import { parseListingInput } from "@/utils/marketplaceListing";
import { drivingDistanceKm } from "@/utils/drivingDistance";

const base = { reservedAt: 0, sellingPrice: 100 };

describe("isListingAvailable with stock", () => {
  it("sells a stock-tracked item while units are left", () => {
    expect(isListingAvailable({ ...base, status: "active", stock: 3 })).toBe(true);
  });
  it("is unavailable at zero stock", () => {
    expect(isListingAvailable({ ...base, status: "active", stock: 0 })).toBe(false);
  });
  it("treats a one-off item (no stock) as before", () => {
    expect(isListingAvailable({ ...base, status: "active", stock: null })).toBe(true);
    expect(isListingAvailable({ ...base, status: "sold", stock: null })).toBe(false);
  });
  it("lets an expired reservation be bought again", () => {
    expect(isListingAvailable({ ...base, status: "reserved", stock: 0 }, 10 * 60 * 60 * 1000)).toBe(true);
    expect(isListingAvailable({ ...base, status: "reserved", stock: 0, reservedAt: Date.now() })).toBe(false);
  });
  it("is never available without a selling price", () => {
    expect(isListingAvailable({ ...base, sellingPrice: null, status: "active", stock: 5 })).toBe(false);
  });
});

const listing = {
  companyId: "c1", title: "Foil", description: "Roll", category: "home_kitchen", condition: "new",
  defects: "None", companyPrice: 8, markup: 0, images: ["https://x/1.jpg"],
};

describe("parseListingInput stock", () => {
  it("accepts a whole-number stock from an admin", () => {
    const r = parseListingInput({ ...listing, stock: 100 }, { admin: true });
    expect("data" in r && r.data.stock).toBe(100);
  });
  it("treats empty stock as a one-off item", () => {
    const r = parseListingInput({ ...listing, stock: "" }, { admin: true });
    expect("data" in r && r.data.stock).toBeNull();
  });
  it("rejects zero, negative and fractional stock", () => {
    for (const stock of [0, -2, 1.5]) {
      expect("error" in parseListingInput({ ...listing, stock }, { admin: true })).toBe(true);
    }
  });
  it("ignores stock sent by a company login", () => {
    const r = parseListingInput({ ...listing, stock: 50 }, { admin: false });
    expect("data" in r && r.data.stock).toBeNull();
  });
});

describe("drivingDistanceKm", () => {
  beforeEach(() => vi.stubEnv("GOOGLE_MAPS_SERVER_API_KEY", "test-key"));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  const a = { lat: -25.7484, lng: 28.2671 };
  const b = { lat: -26.2041, lng: 28.0473 };

  it("uses Google's driving distance", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ rows: [{ elements: [{ status: "OK", distance: { value: 64397 } }] }] }) })));
    expect(await drivingDistanceKm(a, b)).toBe(64.4);
  });
  it("falls back to the straight-line estimate when Google fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const km = await drivingDistanceKm(a, b);
    expect(km).toBeGreaterThan(50);
    expect(km).toBeLessThan(120);
  });
});
