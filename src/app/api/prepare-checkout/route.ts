// app/api/prepare-checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/requireAuth";
import { adminDb } from "@/utils/firebaseAdmin";
import { createCheckout } from "@/utils/peach";

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

      amount = parseFloat(trip.price);
      checkoutMeta = { type: "trip", requestId };
    } else if (payload.type === "plan") {
      const { firmId } = payload;
      if (!firmId) return NextResponse.json({ message: "firmId is required" }, { status: 400 });

      const userSnap = await db.collection("users").doc(uid).get();
      if (userSnap.data()?.firmId !== firmId) {
        return NextResponse.json({ message: "Not your firm" }, { status: 403 });
      }

      const firmSnap = await db.collection("firms").doc(firmId).get();
      if (!firmSnap.exists) return NextResponse.json({ message: "Firm not found" }, { status: 404 });
      const firm = firmSnap.data()!;
      if (!firm.planPrice || !firm.selectedPlan) {
        return NextResponse.json({ message: "No plan selected for this firm" }, { status: 409 });
      }

      amount = Number(firm.planPrice);
      checkoutMeta = { type: "plan", firmId, plan: firm.selectedPlan };
    } else if (payload.type === "billing") {
      const { requestIds } = payload;
      if (!Array.isArray(requestIds) || requestIds.length === 0) {
        return NextResponse.json({ message: "requestIds is required" }, { status: 400 });
      }

      const snaps = await Promise.all(
        requestIds.map((id) => db.collection("pickupRequests").doc(id).get())
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
        total += parseFloat(trip.price || "0");
      }

      amount = total;
      checkoutMeta = { type: "billing", requestIds };
    } else {
      return NextResponse.json({ message: "Invalid payload type" }, { status: 400 });
    }

    if (!amount || amount <= 0) {
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

    return NextResponse.json({ id: result.id }, { status: 200 });
  } catch (error) {
    console.error("Error preparing checkout:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
