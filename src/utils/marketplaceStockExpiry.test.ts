import { describe, it, expect } from "vitest";
import { releaseExpiredOrders } from "./marketplaceStock";

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
