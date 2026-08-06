import { describe, it, expect } from "vitest";
import { normalizeStatus, getStepIndex, getStatusLabel } from "@/lib/tripStatus";

describe("normalizeStatus", () => {
  it("maps legacy status strings to their canonical replacement", () => {
    expect(normalizeStatus("accepted")).toBe("assigned");
    expect(normalizeStatus("in-progress")).toBe("in-transit");
    expect(normalizeStatus("out-for-delivery")).toBe("in-transit");
    expect(normalizeStatus("arrived")).toBe("in-transit");
  });

  it("leaves canonical statuses unchanged", () => {
    for (const status of ["awaiting-payment", "pending", "assigned", "picked-up", "in-transit", "delivered", "completed", "cancelled"]) {
      expect(normalizeStatus(status)).toBe(status);
    }
  });

  it("defaults missing status to pending", () => {
    expect(normalizeStatus(null)).toBe("pending");
    expect(normalizeStatus(undefined)).toBe("pending");
  });
});

describe("getStepIndex", () => {
  it("orders the 6-step lifecycle correctly, including through legacy status names", () => {
    expect(getStepIndex("pending")).toBe(0);
    expect(getStepIndex("accepted")).toBe(1); // legacy -> assigned
    expect(getStepIndex("assigned")).toBe(1);
    expect(getStepIndex("picked-up")).toBe(2);
    expect(getStepIndex("in-progress")).toBe(3); // legacy -> in-transit
    expect(getStepIndex("in-transit")).toBe(3);
    expect(getStepIndex("delivered")).toBe(4);
    expect(getStepIndex("completed")).toBe(5);
  });
});

describe("getStatusLabel", () => {
  it("returns a human-readable label for both canonical and legacy statuses", () => {
    expect(getStatusLabel("assigned")).toBe("Assigned");
    expect(getStatusLabel("accepted")).toBe("Assigned");
    expect(getStatusLabel("in-progress")).toBe("In Transit");
  });
});
