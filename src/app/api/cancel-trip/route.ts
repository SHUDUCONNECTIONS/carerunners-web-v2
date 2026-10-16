// app/api/cancel-trip/route.ts
// Server-authoritative trip cancellation. A client-side updateDoc can't be
// trusted to also refund a paid trip, so cancellation (and any refund it
// requires) now happens here instead, the same way payment confirmation was
// moved server-side in check-payment-status.
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/requireAuth";
import { adminDb } from "@/utils/firebaseAdmin";
import { isRateLimited } from "@/utils/rateLimit";
import { refundPayment, isSuccessCode } from "@/utils/peach";
import { releaseMarketplaceOrder } from "@/utils/marketplaceStock";
import { sendPushToUser } from "@/utils/pushServer";
import { mirrorTripToRtdb } from "@/utils/tripMirror";
import { saDay } from "@/lib/saDate";

// "courier": a paid MarketPortal courier order that hasn't been dispatched yet.
const CANCELLABLE_STATUSES = ["pending", "waiting for driver", "awaiting-payment", "courier"];

// A cancelled MarketPortal delivery cancels its order and puts the item back
// on sale (it was reserved or marked sold when the order was placed).
async function releaseMarketplaceItem(db: FirebaseFirestore.Firestore, trip: FirebaseFirestore.DocumentData) {
  if (!trip.marketOrderId) return;
  // Also gives the units back for stock-tracked items.
  await releaseMarketplaceOrder(db, trip.marketOrderId);
}

// If a runner had already taken the trip, tell them straight away. Best effort: the cancellation itself must
// never fail because a notification could not be sent.
async function alertDriverOfCancellation(trip: FirebaseFirestore.DocumentData, tripId: string, origin: string) {
  if (!trip.driverId) return;
  try {
    await sendPushToUser(trip.driverId, {
      title: "Trip cancelled",
      body: `${trip.pickupLocation} → ${trip.dropoffLocation} was cancelled by the customer.`,
      link: `${process.env.NEXT_PUBLIC_SITE_URL || origin}/driver/dashboard`,
      tag: `trip-${tripId}`,
      urgent: true,
    });
  } catch (err) {
    console.error("Could not alert driver of cancellation:", err);
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (await isRateLimited(adminDb(), `cancel_${user.uid}`, 10, 60)) {
    return NextResponse.json({ message: "Too many requests. Please wait a minute and try again." }, { status: 429 });
  }


  let requestId: string;
  try {
    ({ requestId } = await req.json());
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }
  if (!requestId) {
    return NextResponse.json({ message: "requestId is required" }, { status: 400 });
  }

  const db = adminDb();
  const tripRef = db.collection("pickupRequests").doc(requestId);

  try {
    const tripSnap = await tripRef.get();
    if (!tripSnap.exists) {
      return NextResponse.json({ message: "Trip not found" }, { status: 404 });
    }
    const trip = tripSnap.data()!;

    if (trip.userId !== user.uid) {
      return NextResponse.json({ message: "Not your trip" }, { status: 403 });
    }

    const today = saDay();
    // A courier order's pickupDate is the order date, so it stays cancellable until dispatched.
    if (!CANCELLABLE_STATUSES.includes(trip.status) || (trip.status !== "courier" && trip.pickupDate < today)) {
      return NextResponse.json(
        { message: "This trip can no longer be cancelled" },
        { status: 409 }
      );
    }

    if (trip.payment_status !== "paid") {
      // Nothing was ever charged (unpaid/failed/pending) — no refund needed.
      await tripRef.update({ status: "cancelled", payment_status: "cancelled" });
      await mirrorTripToRtdb(requestId);
      await releaseMarketplaceItem(db, trip);
      await alertDriverOfCancellation(trip, requestId, req.nextUrl.origin);
      return NextResponse.json({ status: "cancelled" });
    }

    // Find the checkout that paid for this trip. Newer trips carry
    // checkoutId directly; fall back to a lookup for trips paid before that
    // field started being written.
    let checkoutSnap;
    if (trip.checkoutId) {
      checkoutSnap = await db.collection("checkouts").doc(trip.checkoutId).get();
    }
    if (!checkoutSnap?.exists) {
      const matches = await db
        .collection("checkouts")
        .where("type", "==", "trip")
        .where("requestId", "==", requestId)
        .where("status", "==", "paid")
        .limit(1)
        .get();
      checkoutSnap = matches.docs[0];
    }

    const paymentId = checkoutSnap?.data()?.peachResult?.id;
    const amount = checkoutSnap?.data()?.amount;
    const currency = checkoutSnap?.data()?.currency || "ZAR";
    if (!checkoutSnap?.exists || !paymentId || !amount) {
      console.error("cancel-trip: could not locate original payment for", requestId);
      return NextResponse.json(
        { message: "Could not locate the original payment to refund. Please contact support." },
        { status: 502 }
      );
    }

    // Claim the refund first so two quick cancel requests can't both refund the same payment.
    const checkoutRef: FirebaseFirestore.DocumentReference = checkoutSnap.ref;
    const claimed = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(checkoutRef);
      const state = fresh.data()?.refundStatus;
      if (state === "refunding" || state === "refunded") return false;
      tx.update(checkoutRef, { refundStatus: "refunding" });
      return true;
    });
    if (!claimed) {
      return NextResponse.json({ message: "This trip is already being refunded." }, { status: 409 });
    }

    const refundResult = await refundPayment({
      paymentId,
      amount: Number(amount).toFixed(2),
      currency,
    });

    if (!isSuccessCode(refundResult?.result?.code)) {
      console.error("cancel-trip: refund failed", refundResult);
      await checkoutRef.update({ refundStatus: "failed", refundResult });
      return NextResponse.json(
        {
          message:
            refundResult?.result?.description ||
            "Refund failed. Please contact support instead of retrying.",
        },
        { status: 502 }
      );
    }

    await checkoutSnap.ref.update({
      refundStatus: "refunded",
      refundResult,
      refundedAt: new Date().toISOString(),
    });
    await tripRef.update({ status: "cancelled", payment_status: "refunded" });
    await mirrorTripToRtdb(requestId);
    await releaseMarketplaceItem(db, trip);
    await alertDriverOfCancellation(trip, requestId, req.nextUrl.origin);

    return NextResponse.json({ status: "cancelled", payment_status: "refunded" });
  } catch (error) {
    console.error("Error cancelling trip:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
