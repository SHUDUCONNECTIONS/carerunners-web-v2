// src/utils/finalizeCheckout.ts
// The one place a checkout is turned into "paid" / "failed". Called from the
// status page's poll (check-payment-status) and from Peach's server-to-server
// notification (peach-webhook), so a payment still completes when the buyer
// closes the tab before the redirect. Always asks Peach for the real result
// with our credentials; nothing from the caller or the webhook body is trusted.
import type { Firestore } from "firebase-admin/firestore";
import { adminAuth } from "@/utils/firebaseAdmin";
import { getPaymentStatus, isSuccessCode, isPendingCode, refundPayment } from "@/utils/peach";
import { markOrderPaid } from "@/utils/marketplaceStock";
import { nextPaidUntil } from "@/lib/plans";
import { mirrorTripToRtdb } from "@/utils/tripMirror";
import { sendAdminOrderNotification, sendAdminTripNotification, sendPaymentReceipt, sendPlanConfirmation } from "@/utils/email";

// A finalize that started this long ago and never finished (crashed function)
// can be taken over by the next caller.
const CLAIM_STALE_MS = 60_000;
const WAIT_STEP_MS = 500;
const WAIT_STEPS = 6;

export type FinalizeOutcome =
  | { kind: "missing" }
  | { kind: "forbidden" }
  | { kind: "ok"; peachResult: any };

async function sendConfirmationEmail(checkout: any, email: string | null, peachResult: any, orderSummary?: string) {
  if (!email) return;
  const amount = peachResult.amount;
  const date = peachResult.timestamp;
  const brand = peachResult.paymentBrand;

  if (checkout.type === "plan") {
    await sendPlanConfirmation({ email, amount, date, brand, planName: checkout.plan });
    return;
  }
  const message =
    checkout.type === "billing"
      ? `This payment covers ${checkout.requestIds.length} trip${checkout.requestIds.length !== 1 ? "s" : ""}.`
      : orderSummary
        ? `Your MarketPortal order: ${orderSummary}. The amount includes delivery.`
        : undefined;
  await sendPaymentReceipt({ email, amount, date, brand, message });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Refunds a payment that arrived for a trip that was already cancelled. Returns true once Peach
// confirms the refund. A failed refund is recorded on the checkout (refundStatus "failed") for an
// admin to sort out by hand; the trip then keeps payment_status "paid" so it shows up as money taken.
async function refundLatePayment(
  checkoutRef: FirebaseFirestore.DocumentReference,
  peachResult: any,
  checkout: any
): Promise<boolean> {
  const paymentId = peachResult?.id;
  const amount = Number(checkout.amount);
  if (!paymentId || !Number.isFinite(amount) || amount <= 0) {
    console.error("finalizeCheckout: late payment on a cancelled trip, but nothing to refund with", checkoutRef.id);
    await checkoutRef.update({ refundStatus: "failed", refundReason: "trip-cancelled" }).catch(() => {});
    return false;
  }
  try {
    const refundResult = await refundPayment({ paymentId, amount: amount.toFixed(2), currency: checkout.currency || "ZAR" });
    const ok = isSuccessCode(refundResult?.result?.code);
    await checkoutRef.update({
      refundStatus: ok ? "refunded" : "failed",
      refundReason: "trip-cancelled",
      refundResult,
      ...(ok ? { refundedAt: new Date().toISOString() } : {}),
    });
    if (!ok) console.error("finalizeCheckout: refund of late payment failed", checkoutRef.id, refundResult);
    return ok;
  } catch (err) {
    console.error("finalizeCheckout: refund of late payment failed", checkoutRef.id, err);
    await checkoutRef.update({ refundStatus: "failed", refundReason: "trip-cancelled" }).catch(() => {});
    return false;
  }
}

// `onlyForUid`: the status page passes the caller's uid so one user can't
// finalize another's checkout. The webhook passes nothing.
export async function finalizeCheckout(
  db: Firestore,
  id: string,
  opts: { origin: string; onlyForUid?: string }
): Promise<FinalizeOutcome> {
  const checkoutRef = db.collection("checkouts").doc(id);

  // Claim the checkout so the webhook and the status page can't both run the
  // side effects (stock, trip status, emails) for the same payment.
  const claim = await db.runTransaction(async (tx) => {
    const snap = await tx.get(checkoutRef);
    if (!snap.exists) return { kind: "missing" as const };
    const data = snap.data()!;
    if (opts.onlyForUid && data.uid !== opts.onlyForUid) return { kind: "forbidden" as const };
    // Terminal states are cached so re-polling doesn't re-send emails or re-run writes.
    if (data.status === "paid" || data.status === "failed") return { kind: "done" as const, data };
    const startedAt = Date.parse(data.finalizingAt ?? "");
    if (data.status === "finalizing" && Date.now() - startedAt < CLAIM_STALE_MS) return { kind: "busy" as const };
    tx.update(checkoutRef, { status: "finalizing", finalizingAt: new Date().toISOString() });
    return { kind: "claimed" as const, data };
  });

  if (claim.kind === "missing") return { kind: "missing" };
  if (claim.kind === "forbidden") return { kind: "forbidden" };
  if (claim.kind === "done") return { kind: "ok", peachResult: claim.data.peachResult };

  if (claim.kind === "busy") {
    // The other caller is mid-way; give it a moment, then report whatever it saved.
    for (let i = 0; i < WAIT_STEPS; i++) {
      await sleep(WAIT_STEP_MS);
      const data = (await checkoutRef.get()).data();
      if (data?.status === "paid" || data?.status === "failed") return { kind: "ok", peachResult: data.peachResult };
    }
    throw new Error("Checkout is still being finalized");
  }

  const checkout = claim.data;
  try {
    const peachResult = await getPaymentStatus(id);
    const code = peachResult?.result?.code;
    const success = isSuccessCode(code);
    const pending = !success && isPendingCode(code);
    const newStatus = success ? "paid" : pending ? "pending" : "failed";

    let newlyRequestedTrip: FirebaseFirestore.DocumentData | undefined;
    let orderSummary: string | undefined;
    let refundedLate = false;

    if (checkout.type === "trip") {
      const update: Record<string, unknown> = { payment_status: newStatus };
      const tripSnap = success ? await db.collection("pickupRequests").doc(checkout.requestId).get() : null;
      const t = tripSnap?.data();
      if (success && t?.status === "cancelled") {
        // Paid after the trip was cancelled (an order that ran out of time, or a trip the customer
        // cancelled while the payment page was still open). Nothing will be delivered: give the money back.
        refundedLate = await refundLatePayment(checkoutRef, peachResult, checkout);
        update.payment_status = refundedLate ? "refunded" : "paid";
        update.checkoutId = id;
      } else if (success) {
        // Every account pays upfront before a trip is driver-visible (see
        // request/page.tsx, which always creates trips as "awaiting-payment"
        // regardless of account type). This flips it to "pending" once
        // payment clears.
        if (t?.status === "awaiting-payment") {
          // A MarketPortal courier order skips the drivers: it waits for an admin to book the courier.
          update.status = t.deliveryMethod === "courier" ? "courier" : "pending";
          newlyRequestedTrip = t;
          if (t.marketOrderId) {
            orderSummary = (await markOrderPaid(db, t.marketOrderId))?.summary;
          }
        }
        // Lets cancel-trip find this payment to refund later without having
        // to search the checkouts collection for it.
        update.checkoutId = id;
      }
      await db.collection("pickupRequests").doc(checkout.requestId).update(update);
      await mirrorTripToRtdb(checkout.requestId);
    } else if (checkout.type === "plan") {
      // The plan paid for is the one recorded when the checkout started, not whatever the company picks afterwards.
      const firmRef = db.collection("firms").doc(checkout.firmId);
      const firm = success ? (await firmRef.get()).data() : undefined;
      await firmRef.update({
        paymentStatus: newStatus,
        ...(success
          ? { lastPaymentDate: new Date().toISOString(), paidPlan: checkout.plan, paidUntil: nextPaidUntil(firm, checkout.plan) }
          : {}),
      });
    } else if (checkout.type === "billing" && success) {
      // These trips are already "completed" (prepare-checkout only allows
      // billing checkout for completed trips) — only payment_status changes.
      const batch = db.batch();
      for (const requestId of checkout.requestIds as string[]) {
        batch.update(db.collection("pickupRequests").doc(requestId), {
          payment_status: "paid",
        });
      }
      await batch.commit();
    }

    await checkoutRef.update({
      status: newStatus,
      peachResult,
      finalizedAt: new Date().toISOString(),
    });

    if (success && !refundedLate) {
      // The money is already recorded; a failed email must not turn this into an error.
      try {
        const email = (await adminAuth().getUser(checkout.uid)).email ?? null;
        await sendConfirmationEmail(checkout, email, peachResult, orderSummary);
        if (newlyRequestedTrip?.marketOrderId) {
          // A purchase: the admins need the items and how it's being delivered, not just a trip.
          await sendAdminOrderNotification({
            summary: orderSummary || "MarketPortal order",
            amount: peachResult.amount,
            buyerEmail: email,
            deliveryAddress: newlyRequestedTrip.dropoffLocation,
            courier: newlyRequestedTrip.deliveryMethod === "courier",
            origin: opts.origin,
          });
        } else if (newlyRequestedTrip) {
          await sendAdminTripNotification({
            pickupLocation: newlyRequestedTrip.pickupLocation,
            dropoffLocation: newlyRequestedTrip.dropoffLocation,
            pickupDate: newlyRequestedTrip.pickupDate,
            pickupTime: newlyRequestedTrip.pickupTime,
            price: newlyRequestedTrip.price,
            customerEmail: email,
            origin: opts.origin,
          });
        }
      } catch (err) {
        console.error("finalizeCheckout: payment saved but notification failed", id, err);
      }
    }

    return { kind: "ok", peachResult };
  } catch (err) {
    // Release the claim so the next poll or webhook retry can try again.
    await checkoutRef.update({ status: "pending" }).catch(() => {});
    throw err;
  }
}
