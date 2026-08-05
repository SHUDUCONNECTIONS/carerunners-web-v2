// app/api/cancel-trip/route.ts
// Server-authoritative trip cancellation. A client-side updateDoc can't be
// trusted to also refund a paid trip, so cancellation (and any refund it
// requires) now happens here instead, the same way payment confirmation was
// moved server-side in check-payment-status.
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/requireAuth";
import { adminDb } from "@/utils/firebaseAdmin";
import { refundPayment, isSuccessCode } from "@/utils/peach";

const CANCELLABLE_STATUSES = ["pending", "waiting for driver", "awaiting-payment"];

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
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

    const today = new Date().toISOString().split("T")[0];
    if (!CANCELLABLE_STATUSES.includes(trip.status) || trip.pickupDate < today) {
      return NextResponse.json(
        { message: "This trip can no longer be cancelled" },
        { status: 409 }
      );
    }

    if (trip.payment_status !== "paid") {
      // Nothing was ever charged (unpaid/failed/pending) — no refund needed.
      await tripRef.update({ status: "cancelled", payment_status: "cancelled" });
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

    const refundResult = await refundPayment({
      paymentId,
      amount: Number(amount).toFixed(2),
      currency,
    });

    if (!isSuccessCode(refundResult?.result?.code)) {
      console.error("cancel-trip: refund failed", refundResult);
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

    return NextResponse.json({ status: "cancelled", payment_status: "refunded" });
  } catch (error) {
    console.error("Error cancelling trip:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
