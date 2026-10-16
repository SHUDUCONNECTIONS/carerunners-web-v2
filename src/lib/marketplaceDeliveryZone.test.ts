import { describe, it, expect } from "vitest";
import {
  COURIER_FEE,
  DELIVERY_FEES,
  DRIVE_SURCHARGES,
  FALLBACK_SPEED_KMH,
  MAX_OUT_OF_PROVINCE_HOURS,
  deliveryDayOptions,
  deliveryFeeFor,
  deliveryZone,
  driveMinutes,
  driveSurcharge,
  isCourier,
  needsProvinceCheck,
} from "./marketplaceDeliveryDay";

// Tuesday 13 Oct 2026, 08:00 in South Africa (before the same-day cut-off).
const tuesday = new Date("2026-10-13T06:00:00Z");
const limit = MAX_OUT_OF_PROVINCE_HOURS * 60;

describe("deliveryZone", () => {
  it("uses our drivers for anything up to the limit, in any province", () => {
    expect(deliveryZone(38, null)).toBe("driver"); // Lynnwood -> Sandton
    expect(deliveryZone(167, false)).toBe("driver"); // Lynnwood -> Polokwane (Limpopo)
    expect(deliveryZone(limit, false)).toBe("driver");
  });

  it("uses our drivers anywhere in the seller's province, however long the drive", () => {
    expect(deliveryZone(limit + 1, true)).toBe("driver");
    expect(deliveryZone(600, true)).toBe("driver");
  });

  it("sends long drives into other provinces by courier", () => {
    expect(deliveryZone(limit + 1, false)).toBe("courier");
    expect(deliveryZone(941, false)).toBe("courier"); // Lynnwood -> Cape Town
  });

  it("treats an unknown province as another province", () => {
    expect(deliveryZone(limit + 1, null)).toBe("courier");
  });

  it("only looks up the province past the limit", () => {
    expect(needsProvinceCheck(limit)).toBe(false);
    expect(needsProvinceCheck(limit + 1)).toBe(true);
  });

  it("marks only the courier zone as courier", () => {
    expect(isCourier("driver")).toBe(false);
    expect(isCourier("courier")).toBe(true);
  });
});

describe("driving time", () => {
  it("uses Google's time, or estimates it from the distance", () => {
    expect(driveMinutes(100, 55)).toBe(55);
    expect(driveMinutes(FALLBACK_SPEED_KMH, null)).toBe(60);
  });

  it("adds a surcharge for long drives", () => {
    expect(driveSurcharge(38)).toBe(0);
    expect(driveSurcharge(90)).toBe(0);
    expect(driveSurcharge(91)).toBe(100);
    expect(driveSurcharge(167)).toBe(100); // Polokwane
    expect(driveSurcharge(180)).toBe(100);
    expect(driveSurcharge(181)).toBe(200);
    expect(driveSurcharge(240)).toBe(200);
  });
});

describe("deliveryFeeFor", () => {
  const [today, tomorrow, later] = deliveryDayOptions(tuesday).map((o) => o.date);

  it("prices driver deliveries by day plus the surcharge", () => {
    expect(deliveryFeeFor("driver", today, 0, tuesday)).toBe(DELIVERY_FEES[0]);
    expect(deliveryFeeFor("driver", tomorrow, 100, tuesday)).toBe(DELIVERY_FEES[1] + 100);
    expect(deliveryFeeFor("driver", later, 200, tuesday)).toBe(DELIVERY_FEES[2] + 200);
    expect(deliveryFeeFor("driver", "2020-01-01", 100, tuesday)).toBeNull();
  });

  it("charges the flat courier price, whatever the day or surcharge", () => {
    expect(deliveryFeeFor("courier", today, 0, tuesday)).toBe(COURIER_FEE);
    expect(deliveryFeeFor("courier", "2020-01-01", 200, tuesday)).toBe(COURIER_FEE);
  });

  it("never makes a courier delivery cheaper than any driver delivery", () => {
    const dearestDriver = Math.max(...DELIVERY_FEES) + Math.max(...DRIVE_SURCHARGES.map((s) => s.amount));
    expect(COURIER_FEE).toBeGreaterThan(dearestDriver);
  });
});
