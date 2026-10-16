import { describe, expect, it } from "vitest";
import { PLAN_DAYS, activePlan, nextPaidUntil } from "./plans";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse("2026-10-15T10:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();

describe("activePlan", () => {
  it("uses the plan the server recorded as paid, not the plan last picked", () => {
    const firm = { paidPlan: "Bronze", paidUntil: iso(now + 5 * DAY), selectedPlan: "Platinum", paymentStatus: "paid" };
    expect(activePlan(firm, now)?.plan.name).toBe("Bronze");
  });

  it("is gone once the paid time runs out", () => {
    expect(activePlan({ paidPlan: "Gold", paidUntil: iso(now - 1) }, now)).toBeNull();
  });

  it("gives companies that paid before paidPlan existed the rest of their month", () => {
    const legacy = { paymentStatus: "paid", selectedPlan: "Silver", lastPaymentDate: iso(now - 10 * DAY) };
    expect(activePlan(legacy, now)?.plan.name).toBe("Silver");
    expect(activePlan({ ...legacy, lastPaymentDate: iso(now - (PLAN_DAYS + 1) * DAY) }, now)).toBeNull();
  });

  it("ignores unknown plans and missing firms", () => {
    expect(activePlan({ paidPlan: "Diamond", paidUntil: iso(now + DAY) }, now)).toBeNull();
    expect(activePlan(undefined, now)).toBeNull();
  });
});

describe("nextPaidUntil", () => {
  it("starts a fresh month for a new plan", () => {
    expect(nextPaidUntil({}, "Bronze", now)).toBe(iso(now + PLAN_DAYS * DAY));
  });

  it("adds to the time left when the same plan is renewed early", () => {
    const firm = { paidPlan: "Bronze", paidUntil: iso(now + 5 * DAY) };
    expect(nextPaidUntil(firm, "Bronze", now)).toBe(iso(now + (5 + PLAN_DAYS) * DAY));
  });

  it("starts afresh when switching plans", () => {
    const firm = { paidPlan: "Bronze", paidUntil: iso(now + 5 * DAY) };
    expect(nextPaidUntil(firm, "Gold", now)).toBe(iso(now + PLAN_DAYS * DAY));
  });
});
