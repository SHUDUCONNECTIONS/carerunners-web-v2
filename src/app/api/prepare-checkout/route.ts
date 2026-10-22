// app/api/prepare-checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/requireAuth";
import { adminDb } from "@/utils/firebaseAdmin";
import { isRateLimited } from "@/utils/rateLimit";
import { createCheckout } from "@/utils/peach";
import { holdOrderForPayment, releaseMarketplaceOrder } from "@/utils/marketplaceStock";
import { findPlan } from "@/lib/plans";
import { priceTrip } from "@/utils/tripPricing";

type TripPayload = { type: "trip"; requestId: string };
type PlanPayload = { type: "plan"; firmId: string };
type BillingPayload = { type: "billing"; requestIds: string[] };
type Payload = TripPayload | PlanPayload | BillingPayload;

const UNPAID_STATUSES = ["unpaid", "failed"];

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { uid } = user;
  if (await isRateLimited(adminDb(), `prepare_${user.uid}`, 10, 60)) {
    return NextResponse.json({ message: "Too many payment attempts. Please wait a minute and try again." }, { status: 429 });
  }


  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const db = adminDb();
  let amount: number;
  let checkoutMeta: Record<string, unknown>;

  try {
    if (payload.type === "trip") {
      const { requestId } = payload;
      if (!requestId) return NextResponse.json({ message: "requestId is required" }, { status: 400 });

      const snap = await db.collection("pickupRequests").doc(requestId).get();
      if (!snap.exists) return NextResponse.json({ message: "Trip not found" }, { status: 404 });
      const trip = snap.data()!;

      if (trip.userId !== uid) {
        return NextResponse.json({ message: "Not your trip" }, { status: 403 });
      }
      if (!UNPAID_STATUSES.includes(trip.payment_status)) {
        return NextResponse.json({ message: "This trip is not awaiting payment" }, { status: 409 });
      }

      let orderSnap: FirebaseFirestore.DocumentSnapshot | null = null;
      // A MarketPortal order can only be paid while its order is still open and every
      // item on it still exists. Otherwise the order is cancelled instead of charged.
      if (trip.marketOrderId) {
        orderSnap = await db.collection("marketplaceOrders").doc(trip.marketOrderId).get();
        const order = orderSnap.data();
        if (order && (order.buyerId !== uid || order.tripId !== requestId)) {
          return NextResponse.json({ message: "This order doesn't belong to this trip" }, { status: 403 });
        }
        // Checks every item is still held for this order and restarts the payment window, so the
        // expiry clean-up can't cancel it (or another buyer take it) while they're on the payment page.
        const held = orderSnap.exists && (await holdOrderForPayment(db, trip.marketOrderId));
        if (!held) {
          if (orderSnap.exists) await releaseMarketplaceOrder(db, trip.marketOrderId);
          await snap.ref.update({ status: "cancelled", payment_status: "cancelled" });
          return NextResponse.json(
            { message: "Sorry, an item on this order is no longer available. Your order has been cancelled and you have not been charged." },
            { status: 409 }
          );
        }
      }

      if (trip.marketOrderId) {
        // MarketPortal: items + delivery, as worked out by the server when the order was placed.
        // Read from the order (server-written), never from money fields on the trip.
        amount = Number(orderSnap?.data()?.totalAmount);
      } else {
        // The trip and its price were written by the browser, so work the price out again from
        // the addresses before charging, and save it so every screen shows what was charged.
        const priced = await priceTrip(trip);
        if ("error" in priced) return NextResponse.json({ message: priced.error }, { status: 422 });
        amount = priced.price;
        await snap.ref.update({ price: priced.price, distance: priced.distanceKm.toFixed(2) });
      }
      checkoutMeta = { type: "trip", requestId };
    } else if (payload.type === "plan") {
      const { firmId } = payload;
      if (!firmId) return NextResponse.json({ message: "firmId is required" }, { status: 400 });

      const userSnap = await db.collection("users").doc(uid).get();
      if (userSnap.data()?.firmId !== firmId) {
        return NextResponse.json({ message: "Not your company account" }, { status: 403 });
      }

      const firmSnap = await db.collection("firms").doc(firmId).get();
      if (!firmSnap.exists) return NextResponse.json({ message: "Company account not found" }, { status: 404 });
      const firm = firmSnap.data()!;
      // The firm document is editable by the company's admin, so the price comes from the plan table.
      const plan = findPlan(firm.selectedPlan);
      if (!plan) {
        return NextResponse.json({ message: "No plan selected for this company account" }, { status: 409 });
      }

      amount = plan.price;
      checkoutMeta = { type: "plan", firmId, plan: firm.selectedPlan };
    } else if (payload.type === "billing") {
      const { requestIds } = payload;
      if (!Array.isArray(requestIds) || requestIds.length === 0) {
        return NextResponse.json({ message: "requestIds is required" }, { status: 400 });
      }

      const uniqueIds = Array.from(new Set(requestIds.map(String)));
      if (uniqueIds.length > 100) {
        return NextResponse.json({ message: "Too many trips in one payment" }, { status: 400 });
      }
      const snaps = await Promise.all(
        uniqueIds.map((id) => db.collection("pickupRequests").doc(id).get())
      );

      let total = 0;
      for (const snap of snaps) {
        if (!snap.exists) return NextResponse.json({ message: `Trip ${snap.id} not found` }, { status: 404 });
        const trip = snap.data()!;
        if (trip.userId !== uid) {
          return NextResponse.json({ message: "Not your trip" }, { status: 403 });
        }
        if (trip.status !== "completed" || !UNPAID_STATUSES.includes(trip.payment_status)) {
          return NextResponse.json({ message: `Trip ${snap.id} is not billable` }, { status: 409 });
        }
        if (trip.marketOrderId) {
          return NextResponse.json({ message: `Trip ${snap.id} is not billable` }, { status: 409 });
        }
        // Same as a single trip: never charge the browser-written price.
        const priced = await priceTrip(trip);
        if ("error" in priced) return NextResponse.json({ message: `Trip ${snap.id}: ${priced.error}` }, { status: 422 });
        await snap.ref.update({ price: priced.price, distance: priced.distanceKm.toFixed(2) });
        total += priced.price;
      }

      amount = Math.round(total * 100) / 100;
      checkoutMeta = { type: "billing", requestIds: uniqueIds };
    } else {
      return NextResponse.json({ message: "Invalid payload type" }, { status: 400 });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ message: "Nothing to charge" }, { status: 409 });
    }

    const result = await createCheckout({ amount: amount.toFixed(2) });
    if (!result?.id) {
      console.error("Peach checkout creation failed:", result);
      return NextResponse.json(
        { message: result?.result?.description || "Could not start payment." },
        { status: 502 }
      );
    }

    // Server-authoritative record of what this checkout is for and who it
    // belongs to — check-payment-status reads this instead of trusting
    // whatever the client claims after the redirect.
    await db.collection("checkouts").doc(result.id).set({
      uid,
      amount,
      currency: "ZAR",
      status: "pending",
      createdAt: new Date().toISOString(),
      ...checkoutMeta,
    });

    return NextResponse.json({ id: result.id, amount }, { status: 200 });
  } catch (error) {
    console.error("Error preparing checkout:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
