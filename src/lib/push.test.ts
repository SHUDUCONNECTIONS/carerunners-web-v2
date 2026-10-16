import { describe, it, expect } from "vitest";
import { riderTripMessage } from "./push";

describe("riderTripMessage", () => {
  it("has a message for each step the rider cares about", () => {
    for (const s of ["assigned", "picked-up", "in-transit", "delivered", "completed"]) {
      expect(riderTripMessage(s)?.title).toBeTruthy();
    }
  });

  it("stays quiet for steps the rider caused or that aren't progress", () => {
    for (const s of ["pending", "awaiting-payment", "cancelled", undefined, null]) {
      expect(riderTripMessage(s as any)).toBeNull();
    }
  });

  it("understands legacy status names", () => {
    expect(riderTripMessage("accepted")).toEqual(riderTripMessage("assigned"));
    expect(riderTripMessage("out-for-delivery")).toEqual(riderTripMessage("in-transit"));
  });
});
