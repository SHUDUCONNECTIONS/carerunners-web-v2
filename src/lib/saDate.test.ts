import { describe, expect, it } from "vitest";
import { saDay, saMonthStart } from "./saDate";

describe("saDay", () => {
  it("is already tomorrow in South Africa while UTC is still on today", () => {
    // 23:30 UTC on 14 Oct is 01:30 on 15 Oct in South Africa.
    expect(saDay(new Date("2026-10-14T23:30:00Z"))).toBe("2026-10-15");
  });

  it("counts days forward across month ends", () => {
    expect(saDay(new Date("2026-10-31T10:00:00Z"), 1)).toBe("2026-11-01");
  });
});

describe("saMonthStart", () => {
  it("is the 1st of the SA month, even just after midnight SA on the 1st (still the previous day in UTC)", () => {
    expect(saMonthStart(new Date("2026-10-31T22:30:00Z"))).toBe("2026-11-01")
    expect(saMonthStart(new Date("2026-11-15T09:00:00Z"))).toBe("2026-11-01")
  })
})
