import { describe, it, expect, vi, beforeEach } from "vitest";

const trips: Record<string, any> = {};
vi.mock("@/utils/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, _col: string, id: string) => id,
  getDoc: async (id: string) => ({ data: () => trips[id] }),
}));
vi.mock("@/utils/authedFetch", () => ({ authedFetch: vi.fn(async () => ({ ok: true })) }));

// The cart lives in localStorage; give the test a small in-memory one.
const storage = new Map<string, string>();
vi.stubGlobal("window", {
  localStorage: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => void storage.set(k, v),
  },
  dispatchEvent: () => true,
});
vi.stubGlobal("Event", class {});

import { authedFetch } from "@/utils/authedFetch";
import { addToCart, loadCart, saveCart } from "./marketplaceCart";
import { cancelUnpaidOrder, settlePendingCart } from "./marketplaceCartSync";

const item = { listingId: "l1", title: "Toy", image: null, unitPrice: 10, stock: 5, quantity: 2 };
const placed = (requestId?: string) =>
  saveCart({ sellerId: "s1", sellerName: "Shop", items: [item], ...(requestId ? { pendingRequestId: requestId } : {}) });

beforeEach(() => {
  storage.clear();
  for (const k of Object.keys(trips)) delete trips[k];
  vi.mocked(authedFetch).mockClear();
});

describe("settlePendingCart", () => {
  it("keeps the items while the order is not paid", async () => {
    placed("t1");
    trips.t1 = { status: "awaiting-payment", payment_status: "unpaid" };
    expect(await settlePendingCart()).toBe("unpaid");
    expect(loadCart().items).toHaveLength(1);
  });

  it("empties the cart once the order is paid", async () => {
    placed("t1");
    trips.t1 = { status: "pending", payment_status: "paid" };
    expect(await settlePendingCart()).toBe("none");
    expect(loadCart().items).toHaveLength(0);
  });

  it("keeps the items but forgets a cancelled or expired order", async () => {
    placed("t1");
    trips.t1 = { status: "cancelled", payment_status: "cancelled" };
    expect(await settlePendingCart()).toBe("none");
    expect(loadCart().items).toHaveLength(1);
    expect(loadCart().pendingRequestId).toBeUndefined();
  });

  it("keeps the items when a late payment was refunded", async () => {
    placed("t1");
    trips.t1 = { status: "cancelled", payment_status: "refunded" };
    await settlePendingCart();
    expect(loadCart().items).toHaveLength(1);
  });

  it("does nothing for a cart with no order placed", async () => {
    placed();
    expect(await settlePendingCart()).toBe("none");
    expect(loadCart().items).toHaveLength(1);
  });
});

describe("cancelUnpaidOrder", () => {
  it("cancels an order still waiting for payment", async () => {
    placed("t1");
    trips.t1 = { status: "awaiting-payment" };
    await cancelUnpaidOrder("t1");
    expect(authedFetch).toHaveBeenCalledWith("/api/cancel-trip", expect.objectContaining({ method: "POST" }));
    expect(loadCart().pendingRequestId).toBeUndefined();
    expect(loadCart().items).toHaveLength(1);
  });

  it("never cancels a paid order", async () => {
    placed("t1");
    trips.t1 = { status: "pending", payment_status: "paid" };
    await cancelUnpaidOrder("t1");
    expect(authedFetch).not.toHaveBeenCalled();
  });
});

it("adding an item keeps track of the unpaid order", () => {
  const cart = { sellerId: "s1", sellerName: "Shop", items: [item], pendingRequestId: "t1" };
  const { cart: next } = addToCart(cart, { id: "s1", name: "Shop" }, { ...item, listingId: "l2" }, 1);
  expect(next.pendingRequestId).toBe("t1");
  expect(next.items).toHaveLength(2);
});
