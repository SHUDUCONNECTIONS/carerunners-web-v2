// app/api/marketplace/notify-status/route.ts
// Emails the buyer when their MarketPortal delivery moves on (runner assigned, picked up, delivered).
// The driver's app calls this after it updates the trip. Only the trip's own driver (or an admin) can
// trigger it, each step is emailed once, and the recipient always comes from the order, never from the request.
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuth } from "@/utils/requireAuth";
import { adminAuth, adminDb } from "@/utils/firebaseAdmin";
import { isAdminUser } from "@/utils/requireAdmin";
import { MARKET_ORDERS, orderLines, orderSummaryText } from "@/lib/marketplace";
import { normalizeStatus } from "@/lib/tripStatus";
import { sendOrderStatusEmail } from "@/utils/email";

const MESSAGES: Record<string, string> = {
  assigned: "A Care Runners driver has accepted your delivery",
  "picked-up": "Your order has been collected and is on its way",
  delivered: "Your order has been delivered",
};
// Courier orders are moved on by an admin (see admin/marketplace): sent, then delivered.
const COURIER_MESSAGES: Record<string, string> = {
  "in-transit": "Your order has been sent by courier",
  delivered: "Your order has been delivered",
};

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  let tripId = "";
  try {
    tripId = String((await req.json())?.tripId ?? "");
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }
  if (!tripId) return NextResponse.json({ message: "tripId is required" }, { status: 400 });

  try {
    const db = adminDb();
    const trip = (await db.collection("pickupRequests").doc(tripId).get()).data();
    if (!trip?.marketOrderId) return NextResponse.json({ sent: false });
    if (trip.driverId !== user.uid && !isAdminUser(user))return NextResponse.json({ message: "Not your delivery" }, { status: 403 });

    const status = normalizeStatus(trip.status);
    const courier = trip.deliveryMethod === "courier";
    const heading = (courier ? COURIER_MESSAGES : MESSAGES)[status];
    if (!heading) return NextResponse.json({ sent: false });

    const orderRef = db.collection(MARKET_ORDERS).doc(trip.marketOrderId);
    const order = (await orderRef.get()).data();
    if (!order || order.status !== "paid" || order.notified?.[status]) return NextResponse.json({ sent: false });

    // Claim this step first so two quick calls can't both send the email.
    await orderRef.update({ [`notified.${status}`]: FieldValue.serverTimestamp() });
    const release = () => orderRef.update({ [`notified.${status}`]: FieldValue.delete() }).catch(() => {});
    const buyer = await adminAuth().getUser(order.buyerId).catch(() => null);
    if (!buyer?.email) {
      await release();
      return NextResponse.json({ sent: false });
    }

    const base = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
    const sent = await sendOrderStatusEmail({
      email: buyer.email,
      heading,
      lines: [
        `Order: ${orderSummaryText(orderLines(order as any), 300)}`,
        `Delivering to: ${order.deliveryAddress}`,
        ...(courier && trip.courierRef ? [`Courier tracking: ${trip.courierRef}`] : []),
      ],
      link: `${base}/trips/tracking?tripId=${tripId}`,
    });
    // A failed send must not use up the step, so the next call can try again.
    if (!sent) await release();
    return NextResponse.json({ sent });
  } catch (err) {
    console.error("Error sending order status email:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
