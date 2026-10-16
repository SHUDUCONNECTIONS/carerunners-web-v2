import { describe, expect, it } from "vitest";
import { publicListingData, publicOrderData } from "./marketplacePublic";

describe("publicListingData", () => {
  it("drops the company price and markup, keeps the selling price", () => {
    const out = publicListingData({ title: "Foil", askingPrice: 100, markupAmount: 30, sellingPrice: 130, reservedBy: "u9" });
    expect(out).toEqual({ title: "Foil", sellingPrice: 130 });
  });

  it("turns timestamps into milliseconds", () => {
    expect(publicListingData({ createdAt: { toMillis: () => 42 } })).toEqual({ createdAt: 42 });
  });
});

describe("publicOrderData", () => {
  it("drops the company's share and payout details from the order and every line", () => {
    const out = publicOrderData({
      itemPrice: 260,
      sellerPrice: 200,
      markupAmount: 60,
      sellerPaidOut: true,
      sellerPayoutRef: "EFT1",
      items: [{ listingId: "a", unitPrice: 130, quantity: 2, sellerUnitPrice: 100, markupUnit: 30 }],
    });
    expect(out).toEqual({ itemPrice: 260, items: [{ listingId: "a", unitPrice: 130, quantity: 2 }] });
  });
});
