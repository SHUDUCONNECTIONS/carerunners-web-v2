import { describe, it, expect } from "vitest";
import { holdOrderForPayment, markOrderPaid, releaseExpiredOrders, releaseExpiredOrdersThrottled } from "./marketplaceStock";
import { reservationActive } from "@/lib/marketplace";

const MIN = 60 * 1000;
const now = Date.parse("2026-10-14T10:00:00Z");
const ts = (ms: number) => ({ toMillis: () => ms });

// In-memory Firestore with what releaseExpiredOrders needs: an equality query, docs and transactions.
function fakeDb(seed: Record<string, Record<string, any>>) {
  const store = seed;
  const ref = (name: string, id: string) => ({
    id,
    get: async () => ({ exists: !!store[name]?.[id], id, ref: ref(name, id), data: () => store[name]?.[id] }),
    update: async (patch: any) => {
      const next = { ...store[name][id] };
      for (const [k, v] of Object.entries(patch)) {
        next[k] = v && typeof v === "object" && "operand" in (v as any) ? (next[k] ?? 0) + (v as any).operand : v;
      }
      store[name][id] = next;
    },
  });
  return {
    _store: store,
    collection: (name: string) => ({
      doc: (id: string) => ref(name, id),
      where: (field: string, _op: string, value: unknown) => ({
        get: async () => ({
          docs: Object.entries(store[name] ?? {})
            .filter(([, d]) => d[field] === value)
            .map(([id, d]) => ({ id, data: () => d })),
        }),
      }),
    }),
    runTransaction: async (fn: any) => fn({ get: (r: any) => r.get(), update: (r: any, p: any) => r.update(p) }),
  };
}

const order = (over: any) => ({
  status: "awaiting-payment",
  tripId: "t1",
  items: [{ listingId: "l1", quantity: 2, title: "Toy", unitPrice: 10 }],
  ...over,
});

describe("releaseExpiredOrders", () => {
  it("cancels an order left unpaid past the window and gives its stock back", async () => {
    const db = fakeDb({
      marketplaceOrders: { o1: order({ createdAt: ts(now - 40 * MIN) }) },
      marketplaceListings: { l1: { stock: 3, status: "active" } },
      pickupRequests: { t1: { status: "awaiting-payment" } },
    });
    await releaseExpiredOrders(db as any, now);
    expect(db._store.marketplaceOrders.o1.status).toBe("cancelled");
    expect(db._store.pickupRequests.t1.status).toBe("cancelled");
  });

  it("leaves an old order alone while the buyer is on the payment page", async () => {
    const db = fakeDb({
      marketplaceOrders: { o1: order({ createdAt: ts(now - 40 * MIN), paymentStartedAt: now - 5 * MIN }) },
      marketplaceListings: { l1: { stock: 3, status: "active" } },
      pickupRequests: { t1: { status: "awaiting-payment" } },
    });
    await releaseExpiredOrders(db as any, now);
    expect(db._store.marketplaceOrders.o1.status).toBe("awaiting-payment");
    expect(db._store.pickupRequests.t1.status).toBe("awaiting-payment");
  });

  it("still cancels it once the payment window has also run out", async () => {
    const db = fakeDb({
      marketplaceOrders: { o1: order({ createdAt: ts(now - 90 * MIN), paymentStartedAt: now - 31 * MIN }) },
      marketplaceListings: { l1: { stock: 3, status: "active" } },
      pickupRequests: { t1: { status: "awaiting-payment" } },
    });
    await releaseExpiredOrders(db as any, now);
    expect(db._store.marketplaceOrders.o1.status).toBe("cancelled");
  });
});

describe("an unpaid order on the last unit", () => {
  it("gives the unit back so the item isn't left at 'Out of stock'", async () => {
    const db = fakeDb({
      marketplaceOrders: { o1: order({ createdAt: ts(now - 40 * MIN), items: [{ listingId: "l1", quantity: 1, title: "Laptop", unitPrice: 5000 }] }) },
      marketplaceListings: { l1: { stock: 0, status: "reserved", reservedAt: ts(now - 40 * MIN), reservedOrderId: "o1" } },
      pickupRequests: { t1: { status: "awaiting-payment" } },
    });
    expect(await releaseExpiredOrders(db as any, now)).toBe(1);
    expect(db._store.marketplaceListings.l1).toMatchObject({ stock: 1, status: "active" });
  });
});

describe("releaseExpiredOrdersThrottled", () => {
  it("runs at most once a minute", async () => {
    const db = fakeDb({
      marketplaceOrders: { o1: order({ createdAt: ts(now - 40 * MIN) }) },
      marketplaceListings: { l1: { stock: 3, status: "active" } },
      pickupRequests: { t1: { status: "awaiting-payment" } },
    });
    expect(await releaseExpiredOrdersThrottled(db as any, now)).toBe(1);
    db._store.marketplaceOrders.o2 = order({ createdAt: ts(now - 40 * MIN), tripId: "t2" });
    db._store.pickupRequests.t2 = { status: "awaiting-payment" };
    expect(await releaseExpiredOrdersThrottled(db as any, now + 30 * 1000)).toBe(0);
    expect(db._store.marketplaceOrders.o2.status).toBe("awaiting-payment");
    expect(await releaseExpiredOrdersThrottled(db as any, now + 61 * 1000)).toBe(1);
  });
});

const oneOff = (over: any) => ({ stock: null, status: "reserved", sellingPrice: 100, reservedOrderId: "oA", ...over });
const laptopOrder = (over: any) => order({ items: [{ listingId: "l1", quantity: 1, title: "Laptop", unitPrice: 5000 }], ...over });
const millis = (v: any) => (v instanceof Date ? v.getTime() : v.toMillis());

describe("a one-off item being paid for", () => {
  it("can't be reserved by a second buyer while the first is on the payment page", async () => {
    // Buyer A checks out at minute 0 and opens the payment page at minute 25.
    const start = now - 31 * MIN;
    const db = fakeDb({
      marketplaceOrders: { oA: laptopOrder({ createdAt: ts(start) }) },
      marketplaceListings: { l1: oneOff({ reservedAt: ts(start) }) },
      pickupRequests: { t1: { status: "awaiting-payment" } },
    });
    expect(await holdOrderForPayment(db as any, "oA", start + 25 * MIN)).toBe(true);

    // Buyer B checks out at minute 31: A's order is kept, and the item still shows as held.
    await releaseExpiredOrders(db as any, now);
    expect(db._store.marketplaceOrders.oA.status).toBe("awaiting-payment");
    const l = db._store.marketplaceListings.l1;
    expect(reservationActive({ status: l.status, reservedAt: millis(l.reservedAt) }, now)).toBe(true);
  });

  it("isn't charged for when another order now holds the item", async () => {
    const db = fakeDb({
      marketplaceOrders: { oA: laptopOrder({ createdAt: ts(now - 40 * MIN) }) },
      marketplaceListings: { l1: oneOff({ reservedOrderId: "oB", reservedAt: ts(now - 5 * MIN) }) },
    });
    expect(await holdOrderForPayment(db as any, "oA", now)).toBe(false);
    expect(db._store.marketplaceOrders.oA.paymentStartedAt).toBeUndefined();
  });

  it("isn't charged for once its order has been cancelled", async () => {
    const db = fakeDb({
      marketplaceOrders: { oA: laptopOrder({ status: "cancelled" }) },
      marketplaceListings: { l1: oneOff({ status: "active", reservedOrderId: undefined }) },
    });
    expect(await holdOrderForPayment(db as any, "oA", now)).toBe(false);
  });

  it("isn't marked sold by an order that no longer holds it", async () => {
    const db = fakeDb({
      marketplaceOrders: { oA: laptopOrder({}) },
      marketplaceListings: { l1: oneOff({ reservedOrderId: "oB" }) },
    });
    await markOrderPaid(db as any, "oA");
    expect(db._store.marketplaceListings.l1.status).toBe("reserved");
  });

  it("is marked sold by the order holding it", async () => {
    const db = fakeDb({
      marketplaceOrders: { oA: laptopOrder({}) },
      marketplaceListings: { l1: oneOff({}) },
    });
    await markOrderPaid(db as any, "oA");
    expect(db._store.marketplaceListings.l1.status).toBe("sold");
  });
});
