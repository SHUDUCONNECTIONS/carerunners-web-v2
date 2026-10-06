import { describe, expect, it } from "vitest";
import {
  EMPTY_CART,
  MAX_CART_LINES,
  addToCart,
  cartCount,
  cartSubtotal,
  clampQuantity,
  removeLine,
  setLineQuantity,
} from "@/lib/marketplaceCart";
import { orderLines, orderSummaryText } from "@/lib/marketplace";

const store = { id: "s1", name: "Care Runners Wholesale" };
const foil = { listingId: "a", title: "Foil", image: null, unitPrice: 8, stock: 100 };
const whisk = { listingId: "b", title: "Whisk", image: null, unitPrice: 10, stock: 5 };

describe("cart", () => {
  it("adds items and totals them", () => {
    let cart = addToCart(EMPTY_CART, store, foil, 3).cart;
    cart = addToCart(cart, store, whisk, 2).cart;
    expect(cart.items).toHaveLength(2);
    expect(cartCount(cart)).toBe(5);
    expect(cartSubtotal(cart)).toBe(3 * 8 + 2 * 10);
  });

  it("merges the same item and never goes over stock", () => {
    let cart = addToCart(EMPTY_CART, store, whisk, 4).cart;
    cart = addToCart(cart, store, whisk, 4).cart;
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(5);
  });

  it("refuses items from a second store", () => {
    const cart = addToCart(EMPTY_CART, store, foil, 1).cart;
    const r = addToCart(cart, { id: "s2", name: "Other Store" }, whisk, 1);
    expect(r.error).toMatch(/Care Runners Wholesale/);
    expect(r.cart.items).toHaveLength(1);
  });

  it("refuses out-of-stock items and over-long carts", () => {
    expect(addToCart(EMPTY_CART, store, { ...foil, stock: 0 }, 1).error).toMatch(/out of stock/);
    let cart = EMPTY_CART;
    for (let i = 0; i < MAX_CART_LINES; i++) cart = addToCart(cart, store, { ...foil, listingId: `x${i}` }, 1).cart;
    expect(addToCart(cart, store, { ...foil, listingId: "extra" }, 1).error).toMatch(/up to/);
  });

  it("limits quantity to stock, and one-off items to one", () => {
    expect(clampQuantity(99, 5)).toBe(5);
    expect(clampQuantity(0, 5)).toBe(1);
    expect(clampQuantity(3, null)).toBe(1);
    const cart = addToCart(EMPTY_CART, store, foil, 2).cart;
    expect(setLineQuantity(cart, "a", 500).items[0].quantity).toBe(100);
  });

  it("empties the cart when the last line is removed", () => {
    const cart = addToCart(EMPTY_CART, store, foil, 1).cart;
    expect(removeLine(cart, "a")).toEqual(EMPTY_CART);
  });
});

describe("order lines", () => {
  it("reads a cart order's items", () => {
    const items = [{ listingId: "a", title: "Foil", image: null, quantity: 3, unitPrice: 8, sellerUnitPrice: 8, markupUnit: 0 }];
    expect(orderLines({ items } as any)).toEqual(items);
  });

  it("turns an older single-product order into one line", () => {
    const [line] = orderLines({
      listingId: "z", listingTitle: "Laptop", listingImage: "i.jpg", quantity: 2, itemPrice: 10000, sellerPrice: 8000, markupAmount: 2000,
    } as any);
    expect(line).toMatchObject({ listingId: "z", title: "Laptop", quantity: 2, unitPrice: 5000, sellerUnitPrice: 4000, markupUnit: 1000 });
  });

  it("summarises lines for receipts", () => {
    expect(orderSummaryText([{ title: "Foil", quantity: 3 }, { title: "Whisk", quantity: 2 }])).toBe("3 x Foil, 2 x Whisk");
    expect(orderSummaryText([{ title: "x".repeat(300), quantity: 1 }], 50).length).toBeLessThanOrEqual(50);
  });
});
