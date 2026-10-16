import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./drivingDistance", () => ({ googleDrivingKm: vi.fn() }));

import { googleDrivingKm } from "./drivingDistance";
import { priceTrip } from "./tripPricing";
import { calculatePrice } from "@/lib/pricing";

const trip = {
  serviceType: "parcel_delivery",
  pickupLocation: "Hatfield, Pretoria",
  dropoffLocation: "Sandton, Johannesburg",
  price: 0.01, // what a tampered browser might save
};

beforeEach(() => vi.mocked(googleDrivingKm).mockReset());

describe("priceTrip", () => {
  it("prices from the saved addresses, ignoring the saved price", async () => {
    vi.mocked(googleDrivingKm).mockResolvedValue(51.41);
    const result = await priceTrip(trip);
    expect(googleDrivingKm).toHaveBeenCalledWith("Hatfield, Pretoria", "Sandton, Johannesburg");
    expect(result).toEqual({ price: calculatePrice("parcel_delivery", 51.41, null), distanceKm: 51.41 });
  });

  it("refuses to price when Google finds no route", async () => {
    vi.mocked(googleDrivingKm).mockResolvedValue(null);
    expect(await priceTrip(trip)).toHaveProperty("error");
  });

  it("refuses unknown service and vehicle types", async () => {
    expect(await priceTrip({ ...trip, serviceType: "toString" })).toHaveProperty("error");
    expect(await priceTrip({ ...trip, serviceType: "home_office_removal", vehicleType: "__proto__" })).toHaveProperty("error");
    expect(googleDrivingKm).not.toHaveBeenCalled();
  });

  it("refuses a trip without both addresses", async () => {
    expect(await priceTrip({ ...trip, dropoffLocation: "  " })).toHaveProperty("error");
  });
});
