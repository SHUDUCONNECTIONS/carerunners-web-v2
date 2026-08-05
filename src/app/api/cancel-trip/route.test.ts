import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/utils/requireAuth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/utils/firebaseAdmin", () => ({ adminDb: vi.fn() }));
vi.mock("@/utils/peach", () => ({ refundPayment: vi.fn(), isSuccessCode: vi.fn() }));

import { requireAuth } from "@/utils/requireAuth";
import { adminDb } from "@/utils/firebaseAdmin";
import { refundPayment, isSuccessCode } from "@/utils/peach";
import { POST } from "./route";

// ── Minimal in-memory Firestore admin fake ─────────────────────────────────
// Supports exactly the surface cancel-trip/route.ts uses: collection(name)
// .doc(id).get()/.update(), and collection(name).where(a).where(b).where(c)
// .limit(n).get() for the checkoutId-less fallback lookup.
function fakeAdminDb(seed: Record<string, Record<string, any>>) {
  const store: Record<string, Record<string, any>> = JSON.parse(JSON.stringify(seed));

  function makeDocSnap(name: string, id: string) {
    const exists = id in store[name];
    return {
      exists,
      id,
      data: () => store[name][id],
      ref: {
        update: async (patch: Record<string, unknown>) => {
          store[name][id] = { ...store[name][id], ...patch };
        },
      },
    };
  }

  return {
    _store: store,
    collection(name: string) {
      return {
        doc(id: string) {
          return {
            get: async () => makeDocSnap(name, id),
            update: async (patch: Record<string, unknown>) => {
              store[name][id] = { ...store[name][id], ...patch };
            },
          };
        },
        where(field: string, _op: string, value: unknown) {
          const filters: [string, unknown][] = [[field, value]];
          const builder = {
            where(f: string, _o: string, v: unknown) {
              filters.push([f, v]);
              return builder;
            },
            limit(_n: number) {
              return builder;
            },
            get: async () => {
              const docs = Object.keys(store[name])
                .filter((id) => filters.every(([f, v]) => store[name][id]?.[f] === v))
                .map((id) => makeDocSnap(name, id));
              return { docs };
            },
          };
          return builder;
        },
      };
    },
  };
}

function req(body: unknown) {
  return { json: async () => body } as any;
}

const AUTH_UID = "user-1";
const TODAY = new Date().toISOString().split("T")[0];
const FUTURE = "2099-01-01";
const PAST = "2000-01-01";

beforeEach(() => {
  vi.mocked(requireAuth).mockReset();
  vi.mocked(adminDb).mockReset();
  vi.mocked(refundPayment).mockReset();
  vi.mocked(isSuccessCode).mockReset();
});

describe("POST /api/cancel-trip", () => {
  it("rejects unauthenticated callers", async () => {
    vi.mocked(requireAuth).mockResolvedValue(null);
    const res = await POST(req({ requestId: "trip-1" }));
    expect(res.status).toBe(401);
  });

  it("rejects a caller who doesn't own the trip", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ uid: AUTH_UID, email: null });
    vi.mocked(adminDb).mockReturnValue(
      fakeAdminDb({
        pickupRequests: {
          "trip-1": { userId: "someone-else", status: "pending", payment_status: "unpaid", pickupDate: FUTURE },
        },
        checkouts: {},
      }) as any
    );
    const res = await POST(req({ requestId: "trip-1" }));
    expect(res.status).toBe(403);
  });

  it("refuses to cancel a trip in a non-cancellable status", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ uid: AUTH_UID, email: null });
    vi.mocked(adminDb).mockReturnValue(
      fakeAdminDb({
        pickupRequests: {
          "trip-1": { userId: AUTH_UID, status: "in-progress", payment_status: "paid", pickupDate: FUTURE },
        },
        checkouts: {},
      }) as any
    );
    const res = await POST(req({ requestId: "trip-1" }));
    expect(res.status).toBe(409);
    expect(refundPayment).not.toHaveBeenCalled();
  });

  it("refuses to cancel once the pickup date has passed", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ uid: AUTH_UID, email: null });
    vi.mocked(adminDb).mockReturnValue(
      fakeAdminDb({
        pickupRequests: {
          "trip-1": { userId: AUTH_UID, status: "pending", payment_status: "unpaid", pickupDate: PAST },
        },
        checkouts: {},
      }) as any
    );
    const res = await POST(req({ requestId: "trip-1" }));
    expect(res.status).toBe(409);
  });

  it("cancels an unpaid trip with no refund call", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ uid: AUTH_UID, email: null });
    const db = fakeAdminDb({
      pickupRequests: {
        "trip-1": { userId: AUTH_UID, status: "awaiting-payment", payment_status: "unpaid", pickupDate: FUTURE },
      },
      checkouts: {},
    });
    vi.mocked(adminDb).mockReturnValue(db as any);

    const res = await POST(req({ requestId: "trip-1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("cancelled");
    expect(refundPayment).not.toHaveBeenCalled();
    expect(db._store.pickupRequests["trip-1"].status).toBe("cancelled");
    expect(db._store.pickupRequests["trip-1"].payment_status).toBe("cancelled");
  });

  it("refunds and cancels a paid trip via its stored checkoutId", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ uid: AUTH_UID, email: null });
    const db = fakeAdminDb({
      pickupRequests: {
        "trip-1": {
          userId: AUTH_UID,
          status: "pending",
          payment_status: "paid",
          pickupDate: FUTURE,
          checkoutId: "chk-1",
        },
      },
      checkouts: {
        "chk-1": {
          type: "trip",
          requestId: "trip-1",
          status: "paid",
          amount: 150,
          currency: "ZAR",
          peachResult: { id: "PAY-123" },
        },
      },
    });
    vi.mocked(adminDb).mockReturnValue(db as any);
    vi.mocked(refundPayment).mockResolvedValue({ result: { code: "000.000.000" } } as any);
    vi.mocked(isSuccessCode).mockReturnValue(true);

    const res = await POST(req({ requestId: "trip-1" }));
    const body = await res.json();

    expect(refundPayment).toHaveBeenCalledWith({ paymentId: "PAY-123", amount: "150.00", currency: "ZAR" });
    expect(res.status).toBe(200);
    expect(body.payment_status).toBe("refunded");
    expect(db._store.pickupRequests["trip-1"].status).toBe("cancelled");
    expect(db._store.pickupRequests["trip-1"].payment_status).toBe("refunded");
    expect(db._store.checkouts["chk-1"].refundStatus).toBe("refunded");
  });

  it("falls back to querying checkouts when the trip has no checkoutId", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ uid: AUTH_UID, email: null });
    const db = fakeAdminDb({
      pickupRequests: {
        "trip-1": { userId: AUTH_UID, status: "pending", payment_status: "paid", pickupDate: FUTURE },
      },
      checkouts: {
        "chk-old": {
          type: "trip",
          requestId: "trip-1",
          status: "paid",
          amount: 75.5,
          currency: "ZAR",
          peachResult: { id: "PAY-OLD" },
        },
      },
    });
    vi.mocked(adminDb).mockReturnValue(db as any);
    vi.mocked(refundPayment).mockResolvedValue({ result: { code: "000.000.000" } } as any);
    vi.mocked(isSuccessCode).mockReturnValue(true);

    const res = await POST(req({ requestId: "trip-1" }));
    expect(res.status).toBe(200);
    expect(refundPayment).toHaveBeenCalledWith({ paymentId: "PAY-OLD", amount: "75.50", currency: "ZAR" });
  });

  it("does NOT cancel the trip if the refund call fails", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ uid: AUTH_UID, email: null });
    const db = fakeAdminDb({
      pickupRequests: {
        "trip-1": {
          userId: AUTH_UID,
          status: "pending",
          payment_status: "paid",
          pickupDate: FUTURE,
          checkoutId: "chk-1",
        },
      },
      checkouts: {
        "chk-1": {
          type: "trip",
          requestId: "trip-1",
          status: "paid",
          amount: 150,
          currency: "ZAR",
          peachResult: { id: "PAY-123" },
        },
      },
    });
    vi.mocked(adminDb).mockReturnValue(db as any);
    vi.mocked(refundPayment).mockResolvedValue({ result: { code: "800.100.100", description: "Declined" } } as any);
    vi.mocked(isSuccessCode).mockReturnValue(false);

    const res = await POST(req({ requestId: "trip-1" }));
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.message).toMatch(/declined|refund/i);
    // Trip must stay exactly as it was — no half-cancelled state.
    expect(db._store.pickupRequests["trip-1"].status).toBe("pending");
    expect(db._store.pickupRequests["trip-1"].payment_status).toBe("paid");
  });

  it("fails closed (502) when the original payment can't be located", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ uid: AUTH_UID, email: null });
    const db = fakeAdminDb({
      pickupRequests: {
        "trip-1": { userId: AUTH_UID, status: "pending", payment_status: "paid", pickupDate: FUTURE },
      },
      checkouts: {},
    });
    vi.mocked(adminDb).mockReturnValue(db as any);

    const res = await POST(req({ requestId: "trip-1" }));
    expect(res.status).toBe(502);
    expect(refundPayment).not.toHaveBeenCalled();
    expect(db._store.pickupRequests["trip-1"].status).toBe("pending");
  });
});
