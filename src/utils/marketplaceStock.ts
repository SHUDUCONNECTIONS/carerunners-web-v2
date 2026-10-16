// src/utils/marketplaceStock.ts
// Server-only. A MarketPortal order can hold several products (a cart). Stock-tracked
// listings (a numeric `stock` field) are taken when the order is placed and given back
// when it is cancelled or its payment window runs out. One-off listings are reserved
// instead, and marked sold once the order is paid.
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { MARKET_LISTINGS, MARKET_ORDERS, RESERVATION_MINUTES, orderLines, orderSummaryText } from "@/lib/marketplace";

// Cancels an unpaid/cancellable order and puts its products back on sale.
// Safe to call twice: an order that is already cancelled is left alone.
export async function releaseMarketplaceOrder(db: Firestore, orderId: string): Promise<void> {
  const orderRef = db.collection(MARKET_ORDERS).doc(orderId);
  await db.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) return;
    const order = orderSnap.data()!;
    if (order.status === "cancelled") return;

    const lines = orderLines(order as any);
    const listings = await Promise.all(lines.map((l) => tx.get(db.collection(MARKET_LISTINGS).doc(l.listingId))));

    tx.update(orderRef, { status: "cancelled" });
    lines.forEach((line, i) => {
      const snap = listings[i];
      if (!snap.exists) return;
      const data = snap.data()!;
      if (typeof data.stock === "number") {
        tx.update(snap.ref, {
          stock: FieldValue.increment(line.quantity),
          status: "active",
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else if (!data.reservedOrderId || data.reservedOrderId === orderId) {
        // A one-off item is only put back on sale if this order is the one holding it.
        tx.update(snap.ref, { status: "active", reservedOrderId: FieldValue.delete() });
      }
    });
  });
}

// Orders that were never paid within the reservation window are cancelled so
// abandoned checkouts don't hold stock forever. The window restarts when the buyer opens the
// payment page (paymentStartedAt), so an order is never cancelled while it is being paid for.
export async function releaseExpiredOrders(db: Firestore, now = Date.now()): Promise<void> {
  const open = await db.collection(MARKET_ORDERS).where("status", "==", "awaiting-payment").get();
  const cutoff = now - RESERVATION_MINUTES * 60 * 1000;
  for (const o of open.docs) {
    const createdAt = o.data().createdAt?.toMillis?.() ?? 0;
    const paymentStartedAt = Number(o.data().paymentStartedAt) || 0;
    if (Math.max(createdAt, paymentStartedAt) >= cutoff) continue;
    await releaseMarketplaceOrder(db, o.id);
    const tripId = o.data().tripId;
    if (tripId) {
      await db
        .collection("pickupRequests")
        .doc(tripId)
        .update({ status: "cancelled", payment_status: "cancelled" })
        .catch(() => {});
    }
  }
}

// Marks an order paid and sells out any product whose last unit it took.
// Returns the receipt lines for the confirmation email.
export async function markOrderPaid(db: Firestore, orderId: string): Promise<{ summary: string; itemTotal: number } | null> {
  const orderRef = db.collection(MARKET_ORDERS).doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) return null;
  const order = orderSnap.data()!;
  await orderRef.update({ status: "paid" });

  for (const line of orderLines(order as any)) {
    const ref = db.collection(MARKET_LISTINGS).doc(line.listingId);
    const stock = (await ref.get()).data()?.stock;
    // Stock-tracked items are only sold once the last unit is paid for.
    if (typeof stock !== "number" || stock <= 0) await ref.update({ status: "sold" }).catch(() => {});
  }
  return { summary: orderSummaryText(orderLines(order as any), 400), itemTotal: Number(order.itemPrice) || 0 };
}
