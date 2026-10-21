import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/utils/firebaseAdmin", () => ({ adminAuth: () => ({ getUser: async () => ({ email: "buyer@x.com" }) }) }));
vi.mock("@/utils/peach", () => ({
  getPaymentStatus: vi.fn(),
  refundPayment: vi.fn(),
  isSuccessCode: (c: unknown) => typeof c === "string" && c.startsWith("000.000"),
  isPendingCode: () => false,
}));
vi.mock("@/utils/marketplaceStock", () => ({ markOrderPaid: vi.fn(async () => ({ summary: "1 x Toy", itemTotal: 10 })) }));
vi.mock("@/utils/email", () => ({
  sendAdminOrderNotification: vi.fn(),
  sendAdminTripNotification: vi.fn(),
  sendPaymentReceipt: vi.fn(),
  sendPlanConfirmation: vi.fn(),
}));

import { getPaymentStatus, refundPayment } from "@/utils/peach";
import { markOrderPaid } from "@/utils/marketplaceStock";
import { sendAdminOrderNotification, sendAdminTripNotification, sendPaymentReceipt } from "@/utils/email";
import { finalizeCheckout } from "./finalizeCheckout";

// Minimal in-memory Firestore: doc get/update and transactions over them.
function fakeDb(seed: Record<string, Record<string, any>>) {
  const store: Record<string, Record<string, any>> = JSON.parse(JSON.stringify(seed));
  const ref = (name: string, id: string) => ({
    id,
    get: async () => ({ exists: !!store[name]?.[id], id, data: () => store[name]?.[id] }),
    update: async (patch: any) => void (store[name][id] = { ...store[name][id], ...patch }),
  });
  return {
    _store: store,
    collection: (name: string) => ({ doc: (id: string) => ref(name, id) }),
    runTransaction: async (fn: any) => fn({ get: (r: any) => r.get(), update: (r: any, p: any) => r.update(p) }),
  };
}

const paid = { id: "pay1", result: { code: "000.000.000" }, amount: "120.00" };
const seed = (trip: any) => ({
  checkouts: { chk1: { uid: "u1", type: "trip", requestId: "t1", amount: 120, currency: "ZAR", status: "pending" } },
  pickupRequests: { t1: { userId: "u1", payment_status: "unpaid", ...trip } },
});
const run = (db: any) => finalizeCheckout(db, "chk1", { origin: "http://x" });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPaymentStatus).mockResolvedValue(paid);
});

describe("finalizeCheckout", () => {
  it("records the plan that was paid for and when it runs out, whatever the company picks afterwards", async () => {
    const db = fakeDb({
      checkouts: { chk1: { uid: "u1", type: "plan", firmId: "f1", plan: "Bronze", amount: 50, currency: "ZAR", status: "pending" } },
      // The company switched to Platinum after starting to pay for Bronze.
      firms: { f1: { adminId: "u1", selectedPlan: "Platinum" } },
    });
    const before = Date.now();
    await run(db);
    const firm = db._store.firms.f1;
    expect(firm).toMatchObject({ paymentStatus: "paid", paidPlan: "Bronze", selectedPlan: "Platinum" });
    const days = (Date.parse(firm.paidUntil) - before) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });

  it("books a paid trip for the drivers", async () => {
    const db = fakeDb(seed({ status: "awaiting-payment" }));
    await run(db);
    expect(db._store.pickupRequests.t1).toMatchObject({ status: "pending", payment_status: "paid", checkoutId: "chk1" });
    expect(refundPayment).not.toHaveBeenCalled();
    expect(sendPaymentReceipt).toHaveBeenCalled();
    expect(sendAdminTripNotification).toHaveBeenCalledTimes(1);
    expect(sendAdminOrderNotification).not.toHaveBeenCalled();
  });

  it("sends a paid courier order to the admins, not the drivers", async () => {
    const db = fakeDb(seed({ status: "awaiting-payment", deliveryMethod: "courier", marketOrderId: "o1", dropoffLocation: "2 Buyer St" }));
    await run(db);
    expect(db._store.pickupRequests.t1.status).toBe("courier");
    expect(markOrderPaid).toHaveBeenCalledWith(db, "o1");
    // Admins get the order email (items, amount, courier), not the "trip waiting for a driver" one.
    expect(sendAdminOrderNotification).toHaveBeenCalledWith(
      expect.objectContaining({ summary: "1 x Toy", amount: "120.00", buyerEmail: "buyer@x.com", deliveryAddress: "2 Buyer St", courier: true })
    );
    expect(sendAdminTripNotification).not.toHaveBeenCalled();
  });

  it("tells the admins about a paid MarketPortal order delivered by a driver", async () => {
    const db = fakeDb(seed({ status: "awaiting-payment", marketOrderId: "o1" }));
    await run(db);
    expect(db._store.pickupRequests.t1.status).toBe("pending");
    expect(sendAdminOrderNotification).toHaveBeenCalledWith(expect.objectContaining({ courier: false }));
    expect(sendAdminTripNotification).not.toHaveBeenCalled();
  });

  it("refunds a payment that arrives after the trip was cancelled", async () => {
    vi.mocked(refundPayment).mockResolvedValue({ result: { code: "000.000.000" } });
    const db = fakeDb(seed({ status: "cancelled", payment_status: "cancelled", marketOrderId: "o1" }));
    await run(db);
    expect(refundPayment).toHaveBeenCalledWith({ paymentId: "pay1", amount: "120.00", currency: "ZAR" });
    expect(db._store.pickupRequests.t1).toMatchObject({ status: "cancelled", payment_status: "refunded" });
    expect(db._store.checkouts.chk1).toMatchObject({ status: "paid", refundStatus: "refunded", refundReason: "trip-cancelled" });
    // The cancelled order is not revived and the buyer gets no "thanks for your order" receipt.
    expect(markOrderPaid).not.toHaveBeenCalled();
    expect(sendPaymentReceipt).not.toHaveBeenCalled();
  });

  it("flags a late payment for an admin when the refund fails", async () => {
    vi.mocked(refundPayment).mockResolvedValue({ result: { code: "800.100.100" } });
    const db = fakeDb(seed({ status: "cancelled" }));
    await run(db);
    expect(db._store.pickupRequests.t1).toMatchObject({ status: "cancelled", payment_status: "paid" });
    expect(db._store.checkouts.chk1.refundStatus).toBe("failed");
  });

  it("only refunds once when the status page and the webhook both finalize", async () => {
    vi.mocked(refundPayment).mockResolvedValue({ result: { code: "000.000.000" } });
    const db = fakeDb(seed({ status: "cancelled" }));
    await run(db);
    await run(db);
    expect(refundPayment).toHaveBeenCalledTimes(1);
  });
});
