import { describe, it, expect } from "vitest";
import { formatRand } from "./marketplace";

// en-ZA groups thousands with a non-breaking space; compare with a plain space.
const fmt = (n: number | null | undefined) => formatRand(n).replace(/\s/g, " ");

describe("formatRand", () => {
  it("shows whole amounts without cents", () => {
    expect(fmt(24)).toBe("R24");
    expect(fmt(1001)).toBe("R1 001");
  });

  it("always shows two decimals when there are cents", () => {
    expect(fmt(62.4)).toBe("R62,40");
    expect(fmt(16.9)).toBe("R16,90");
    expect(fmt(1001.5)).toBe("R1 001,50");
    expect(fmt(127.35)).toBe("R127,35");
  });

  it("rounds floating-point noise and treats missing amounts as zero", () => {
    expect(fmt(0.1 + 0.2)).toBe("R0,30");
    expect(fmt(24.000000001)).toBe("R24");
    expect(fmt(null)).toBe("R0");
    expect(fmt(undefined)).toBe("R0");
  });
});
