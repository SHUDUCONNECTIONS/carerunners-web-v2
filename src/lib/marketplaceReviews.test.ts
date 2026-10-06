import { describe, expect, it } from "vitest";
import { MAX_COMMENT, applyRating, averageRating, parseReview, publicName } from "@/lib/marketplaceReviews";

describe("ratings", () => {
  it("has no average until someone rates", () => {
    expect(averageRating(0, 0)).toBeNull();
    expect(averageRating(undefined, undefined)).toBeNull();
  });
  it("averages to one decimal", () => {
    expect(averageRating(14, 3)).toBe(4.7);
    expect(averageRating(5, 1)).toBe(5);
  });
  it("adds a new rating", () => {
    expect(applyRating(9, 2, null, 5)).toEqual({ sum: 14, count: 3 });
  });
  it("swaps an edited rating without changing the count", () => {
    expect(applyRating(14, 3, 5, 2)).toEqual({ sum: 11, count: 3 });
  });
});

describe("parseReview", () => {
  it("accepts 1 to 5 stars with an optional comment", () => {
    expect(parseReview({ rating: 4, comment: "  Great  " })).toEqual({ rating: 4, comment: "Great" });
    expect(parseReview({ rating: "5" })).toEqual({ rating: 5, comment: "" });
  });
  it("rejects bad ratings and long comments", () => {
    for (const rating of [0, 6, 2.5, "x", undefined]) expect("error" in parseReview({ rating })).toBe(true);
    expect("error" in parseReview({ rating: 3, comment: "x".repeat(MAX_COMMENT + 1) })).toBe(true);
  });
});

describe("publicName", () => {
  it("shows a first name and last initial only", () => {
    expect(publicName("Thabo Mokoena")).toBe("Thabo M.");
    expect(publicName("Thabo")).toBe("Thabo");
    expect(publicName("  ")).toBe("Customer");
    expect(publicName(undefined)).toBe("Customer");
  });
});

describe("moderation totals", () => {
  it("takes a rating out and puts it back", async () => {
    const { withRating, withoutRating } = await import("@/lib/marketplaceReviews");
    expect(withoutRating(14, 3, 5)).toEqual({ sum: 9, count: 2 });
    expect(withRating(9, 2, 5)).toEqual({ sum: 14, count: 3 });
  });
  it("never goes below zero", async () => {
    const { withoutRating } = await import("@/lib/marketplaceReviews");
    expect(withoutRating(0, 0, 5)).toEqual({ sum: 0, count: 0 });
  });
});
