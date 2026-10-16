import { describe, it, expect } from "vitest";
import {
  deliveryDayOptions,
  isAllowedDeliveryDate,
  deliveryTimeText,
  deliveryFeeForDate,
  defaultDeliveryDate,
} from "./marketplaceDeliveryDay";

// Tuesday 13 Oct 2026, midday in South Africa.
const tuesday = new Date("2026-10-13T10:00:00Z");

describe("deliveryDayOptions", () => {
  it("offers today, tomorrow and the day after by weekday name", () => {
    expect(deliveryDayOptions(tuesday).map((o) => [o.label, o.date])).toEqual([
      ["Today", "2026-10-13"],
      ["Tomorrow", "2026-10-14"],
      ["Thursday", "2026-10-15"],
    ]);
  });

  it("uses South African time: 23:30 UTC is already the next day there", () => {
    const late = new Date("2026-10-13T23:30:00Z");
    expect(deliveryDayOptions(late)[0].date).toBe("2026-10-14");
  });

  it("rolls over month ends", () => {
    expect(deliveryDayOptions(new Date("2026-10-31T10:00:00Z")).map((o) => o.date)).toEqual(["2026-10-31", "2026-11-01", "2026-11-02"]);
  });
});

describe("isAllowedDeliveryDate", () => {
  it("accepts only the three offered days", () => {
    expect(isAllowedDeliveryDate("2026-10-15", tuesday)).toBe(true);
    expect(isAllowedDeliveryDate("2026-10-16", tuesday)).toBe(false);
    expect(isAllowedDeliveryDate("2026-10-12", tuesday)).toBe(false);
    expect(isAllowedDeliveryDate(undefined, tuesday)).toBe(false);
    expect(isAllowedDeliveryDate("tomorrow", tuesday)).toBe(false);
  });
});

describe("deliveryTimeText", () => {
  it("describes the chosen day", () => {
    expect(deliveryTimeText("2026-10-13", tuesday)).toBe("Any time today");
    expect(deliveryTimeText("2026-10-14", tuesday)).toBe("Any time tomorrow");
    expect(deliveryTimeText("2026-10-15", tuesday)).toBe("Any time on Thursday");
  });
});

// Tuesday 13 Oct 2026: 09:00 SA = 07:00Z (before cut-off), 14:00 SA = 12:00Z (after).
const morning = new Date("2026-10-13T07:00:00Z");
const afternoon = new Date("2026-10-13T12:00:00Z");

describe("fixed delivery prices", () => {
  it("costs more the sooner it arrives", () => {
    expect(deliveryDayOptions(morning).map((o) => o.fee)).toEqual([149, 99, 69]);
  });

  it("is the same price whatever the distance (price depends only on the day)", () => {
    expect(deliveryFeeForDate("2026-10-14", morning)).toBe(99);
  });

  it("stops offering same-day delivery after the cut-off", () => {
    expect(deliveryDayOptions(morning)[0].available).toBe(true);
    expect(deliveryDayOptions(afternoon)[0].available).toBe(false);
    expect(isAllowedDeliveryDate("2026-10-13", afternoon)).toBe(false);
    expect(deliveryFeeForDate("2026-10-13", afternoon)).toBeNull();
    expect(deliveryFeeForDate("2026-10-14", afternoon)).toBe(99);
  });

  it("takes same-day orders until 10:00 South African time", () => {
    expect(deliveryDayOptions(new Date("2026-10-13T07:59:00Z"))[0].available).toBe(true); // 09:59
    expect(deliveryDayOptions(new Date("2026-10-13T08:00:00Z"))[0].available).toBe(false); // 10:00
  });

  it("selects the soonest available day by default", () => {
    expect(defaultDeliveryDate(morning)).toBe("2026-10-13");
    expect(defaultDeliveryDate(afternoon)).toBe("2026-10-14");
  });

  it("rejects dates that are not offered", () => {
    expect(deliveryFeeForDate("2026-10-20", morning)).toBeNull();
  });
});
