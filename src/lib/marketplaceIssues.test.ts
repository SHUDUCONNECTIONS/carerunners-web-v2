import { describe, expect, it } from "vitest";
import { ISSUE_WINDOW_DAYS, MAX_ISSUE_TEXT, parseIssue, withinIssueWindow } from "@/lib/marketplaceIssues";

describe("parseIssue", () => {
  const ok = { orderId: "o1", reason: "damaged", description: "The box was crushed and two items broke." };
  it("accepts a clear report", () => {
    expect(parseIssue(ok)).toEqual(ok);
  });
  it("needs an order, a known reason and a real description", () => {
    expect("error" in parseIssue({ ...ok, orderId: "" })).toBe(true);
    expect("error" in parseIssue({ ...ok, reason: "nope" })).toBe(true);
    expect("error" in parseIssue({ ...ok, description: "bad" })).toBe(true);
    expect("error" in parseIssue({ ...ok, description: "x".repeat(MAX_ISSUE_TEXT + 1) })).toBe(true);
  });
});

describe("withinIssueWindow", () => {
  const day = 24 * 60 * 60 * 1000;
  it("accepts recent orders and refuses old or unknown ones", () => {
    const now = 1_000_000_000_000;
    expect(withinIssueWindow(now - 3 * day, now)).toBe(true);
    expect(withinIssueWindow(now - (ISSUE_WINDOW_DAYS + 1) * day, now)).toBe(false);
    expect(withinIssueWindow(0, now)).toBe(false);
  });
});
