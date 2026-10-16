import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/utils/rateLimit", () => ({ isRateLimited: vi.fn(async () => false) }));
vi.mock("@/utils/requireAuth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/utils/firebaseAdmin", () => ({ adminDb: vi.fn() }));
vi.mock("@/utils/peach", () => ({ createCheckout: vi.fn() }));
vi.mock("@/utils/tripPricing", () => ({ priceTrip: vi.fn() }));
vi.mock("@/utils/marketplaceStock", () => ({ releaseMarketplaceOrder: vi.fn() }));

import { requireAuth } from "@/utils/requireAuth";
import { adminDb } from "@/utils/firebaseAdmin";
import { isRateLimited } from "@/utils/rateLimit";
import { createCheckout } from "@/utils/peach";
import { priceTrip } from "@/utils/tripPricing";
import { standardPlans } from "@/lib/plans";
import { POST } from "./route";

// Minimal in-memory Firestore: collection(name).doc(id).get()/set(), and snap.ref.update().
function fakeDb(seed: Record<string, Record<string, any>>) {
  const store: Record<string, Record<string, any>> = JSON.parse(JSON.stringify(seed));
  const snapOf = (name: string, id: string) => ({
    exists: !!store[name]?.[id],
    id,
    data: () => store[name]?.[id],
    ref: {
      update: async (patch: any) => void (store[name][id] = { ...store[name][id], ...patch }),
    },
  });
  return {
    _store: store,
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => snapOf(name, id),
        set: async (v: any) => void ((store[name] ??= {})[id] = v),
      }),
    }),
  };
}

const call = (body: unknown) =>
  POST(new Request("http://x/api/prepare-checkout", { method: "POST", body: JSON.stringify(body) }) as any);

const signedIn = () => vi.mocked(requireAuth).mockResolvedValue({ uid: "u1", email: "a@x.com", emailVerified: true } as any);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(isRateLimited).mockResolvedValue(false);
  vi.mocked(createCheckout).mockResolvedValue({ id: "chk1" });
  vi.mocked(priceTrip).mockResolvedValue({ price: 120, distanceKm: 10 });
});

describe("prepare-checkout", () => {
  it("rejects people who are not signed in", async () => {
    vi.mocked(requireAuth).mockResolvedValue(null as any);
    expect((await call({ type: "trip", requestId: "t1" })).status).toBe(401);
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it("returns 429 when over the rate limit", async () => {
    signedIn();
    vi.mocked(isRateLimited).mockResolvedValue(true);
    vi.mocked(adminDb).mockReturnValue(fakeDb({}) as any);
    expect((await call({ type: "trip", requestId: "t1" })).status).toBe(429);
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it("rejects an unknown payload type", async () => {
    signedIn();
    vi.mocked(adminDb).mockReturnValue(fakeDb({}) as any);
    expect((await call({ type: "free-stuff" })).status).toBe(400);
  });

  describe("trip", () => {
    const trip = (over: any = {}) => ({
      pickupRequests: { t1: { userId: "u1", payment_status: "unpaid", price: 1, ...over } },
    });

    it("charges the price worked out on the server, not the one saved by the browser", async () => {
      signedIn();
      const db = fakeDb(trip());
      vi.mocked(adminDb).mockReturnValue(db as any);
      const res = await call({ type: "trip", requestId: "t1" });
      expect(res.status).toBe(200);
      expect(createCheckout).toHaveBeenCalledWith({ amount: "120.00" });
      expect(db._store.pickupRequests.t1.price).toBe(120);
      expect(db._store.checkouts.chk1).toMatchObject({ uid: "u1", amount: 120, type: "trip", requestId: "t1" });
    });

    it("refuses to start a payment for someone else's trip", async () => {
      signedIn();
      vi.mocked(adminDb).mockReturnValue(fakeDb(trip({ userId: "other" })) as any);
      expect((await call({ type: "trip", requestId: "t1" })).status).toBe(403);
      expect(createCheckout).not.toHaveBeenCalled();
    });

    it("refuses to charge a trip that is already paid", async () => {
      signedIn();
      vi.mocked(adminDb).mockReturnValue(fakeDb(trip({ payment_status: "paid" })) as any);
      expect((await call({ type: "trip", requestId: "t1" })).status).toBe(409);
      expect(createCheckout).not.toHaveBeenCalled();
    });

    it("returns 404 for a trip that does not exist", async () => {
      signedIn();
      vi.mocked(adminDb).mockReturnValue(fakeDb({}) as any);
      expect((await call({ type: "trip", requestId: "nope" })).status).toBe(404);
    });

    it("passes on a pricing problem without charging", async () => {
      signedIn();
      vi.mocked(priceTrip).mockResolvedValue({ error: "Could not work out the distance" });
      vi.mocked(adminDb).mockReturnValue(fakeDb(trip()) as any);
      expect((await call({ type: "trip", requestId: "t1" })).status).toBe(422);
      expect(createCheckout).not.toHaveBeenCalled();
    });

    it("cancels instead of charging when a marketplace item is no longer available", async () => {
      signedIn();
      const db = fakeDb({
        pickupRequests: { t1: { userId: "u1", payment_status: "unpaid", marketOrderId: "o1" } },
        marketplaceOrders: { o1: { buyerId: "u1", tripId: "t1", status: "awaiting-payment", listingId: "l1", quantity: 1 } },
        marketplaceListings: { l1: { status: "rejected" } },
      });
      vi.mocked(adminDb).mockReturnValue(db as any);
      const res = await call({ type: "trip", requestId: "t1" });
      expect(res.status).toBe(409);
      expect(db._store.pickupRequests.t1.status).toBe("cancelled");
      expect(createCheckout).not.toHaveBeenCalled();
    });
  });

  describe("plan", () => {
    it("charges the plan table price even if the firm document was edited", async () => {
      signedIn();
      const plan = standardPlans[0];
      const db = fakeDb({
        users: { u1: { firmId: "f1" } },
        firms: { f1: { selectedPlan: plan.name, price: 1 } },
      });
      vi.mocked(adminDb).mockReturnValue(db as any);
      const res = await call({ type: "plan", firmId: "f1" });
      expect(res.status).toBe(200);
      expect(createCheckout).toHaveBeenCalledWith({ amount: plan.price.toFixed(2) });
    });

    it("rejects a company the user does not belong to", async () => {
      signedIn();
      vi.mocked(adminDb).mockReturnValue(fakeDb({ users: { u1: { firmId: "other" } }, firms: { f1: {} } }) as any);
      expect((await call({ type: "plan", firmId: "f1" })).status).toBe(403);
      expect(createCheckout).not.toHaveBeenCalled();
    });
  });

  describe("billing", () => {
    const completed = (over: any = {}) => ({ userId: "u1", status: "completed", payment_status: "unpaid", ...over });

    it("adds up the server-priced trips and ignores duplicate ids", async () => {
      signedIn();
      vi.mocked(adminDb).mockReturnValue(fakeDb({ pickupRequests: { a: completed(), b: completed() } }) as any);
      const res = await call({ type: "billing", requestIds: ["a", "b", "a"] });
      expect(res.status).toBe(200);
      expect(createCheckout).toHaveBeenCalledWith({ amount: "240.00" });
    });

    it("rejects trips that are not completed", async () => {
      signedIn();
      vi.mocked(adminDb).mockReturnValue(fakeDb({ pickupRequests: { a: completed({ status: "pending" }) } }) as any);
      expect((await call({ type: "billing", requestIds: ["a"] })).status).toBe(409);
    });

    it("rejects someone else's trip", async () => {
      signedIn();
      vi.mocked(adminDb).mockReturnValue(fakeDb({ pickupRequests: { a: completed({ userId: "x" }) } }) as any);
      expect((await call({ type: "billing", requestIds: ["a"] })).status).toBe(403);
    });

    it("rejects an empty or oversized list", async () => {
      signedIn();
      vi.mocked(adminDb).mockReturnValue(fakeDb({}) as any);
      expect((await call({ type: "billing", requestIds: [] })).status).toBe(400);
      const many = Array.from({ length: 101 }, (_, i) => `t${i}`);
      expect((await call({ type: "billing", requestIds: many })).status).toBe(400);
    });
  });

  it("returns 502 when Peach cannot create the checkout", async () => {
    signedIn();
    vi.mocked(createCheckout).mockResolvedValue({ result: { description: "declined" } });
    vi.mocked(adminDb).mockReturnValue(fakeDb({ pickupRequests: { t1: { userId: "u1", payment_status: "unpaid" } } }) as any);
    expect((await call({ type: "trip", requestId: "t1" })).status).toBe(502);
  });
});
