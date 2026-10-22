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
// Returns how many orders it cancelled.
export async function releaseExpiredOrders(db: Firestore, now = Date.now()): Promise<number> {
  const open = await db.collection(MARKET_ORDERS).where("status", "==", "awaiting-payment").get();
  const cutoff = now - RESERVATION_MINUTES * 60 * 1000;
  let released = 0;
  for (const o of open.docs) {
    const createdAt = o.data().createdAt?.toMillis?.() ?? 0;
    const paymentStartedAt = Number(o.data().paymentStartedAt) || 0;
    if (Math.max(createdAt, paymentStartedAt) >= cutoff) continue;
    await releaseMarketplaceOrder(db, o.id);
    released++;
    const tripId = o.data().tripId;
    if (tripId) {
      await db
        .collection("pickupRequests")
        .doc(tripId)
        .update({ status: "cancelled", payment_status: "cancelled" })
        .catch(() => {});
    }
  }
  return released;
}

// Browsing runs the clean-up too, otherwise an abandoned order keeps its stock (and the item
// shows "Out of stock") until someone else happens to check out. At most once a minute per
// server instance, and best effort: viewing the shop never fails because of it.
const RELEASE_EVERY_MS = 60 * 1000;
let lastRelease = 0;
export async function releaseExpiredOrdersThrottled(db: Firestore, now = Date.now()): Promise<number> {
  if (now - lastRelease < RELEASE_EVERY_MS) return 0;
  lastRelease = now;
  try {
    return await releaseExpiredOrders(db, now);
  } catch (err) {
    console.error("Releasing expired MarketPortal orders failed:", err);
    return 0;
  }
}

// The buyer is opening the payment page. Checks the order can still be paid for and, if so,
// restarts its payment window. The listings it holds get the same new time, so checkout (which
// reads the listing) and the expiry clean-up (which reads the order) agree on when the hold ends.
// Otherwise a second buyer could reserve a one-off item that the first buyer is still paying for.
export async function holdOrderForPayment(db: Firestore, orderId: string, now = Date.now()): Promise<boolean> {
  const orderRef = db.collection(MARKET_ORDERS).doc(orderId);
  return db.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists || orderSnap.data()!.status !== "awaiting-payment") return false;
    const lines = orderLines(orderSnap.data() as any);
    const listings = await Promise.all(lines.map((l) => tx.get(db.collection(MARKET_LISTINGS).doc(l.listingId))));
    const payable = listings.every((snap) => {
      const l = snap.data();
      if (!l || l.status === "inactive" || l.status === "rejected") return false;
      // A one-off item must still be held by this order, not taken over by another buyer.
      return typeof l.stock === "number" || (l.status === "reserved" && l.reservedOrderId === orderId);
    });
    if (!payable) return false;
    tx.update(orderRef, { paymentStartedAt: now });
    for (const snap of listings) {
      if (snap.data()!.reservedOrderId === orderId) tx.update(snap.ref, { reservedAt: new Date(now) });
    }
    return true;
  });
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
    const listing = (await ref.get()).data();
    const stock = listing?.stock;
    // A one-off item held by another order isn't this buyer's to mark sold.
    if (typeof stock !== "number" && listing?.reservedOrderId && listing.reservedOrderId !== orderId) continue;
    // Stock-tracked items are only sold once the last unit is paid for.
    if (typeof stock !== "number" || stock <= 0) await ref.update({ status: "sold" }).catch(() => {});
  }
  return { summary: orderSummaryText(orderLines(order as any), 400), itemTotal: Number(order.itemPrice) || 0 };
}
