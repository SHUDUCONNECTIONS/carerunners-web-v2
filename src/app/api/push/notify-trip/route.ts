// app/api/push/notify-trip/route.ts
// Pushes the rider when their trip moves on. The driver's app calls this after it updates the trip.
// Only the trip's own driver (or an admin) can trigger it, each step is pushed once, and the recipient always
// comes from the trip, never from the request.
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuth } from "@/utils/requireAuth";
import { adminDb } from "@/utils/firebaseAdmin";
import { isRateLimited } from "@/utils/rateLimit";
import { isAdminUser } from "@/utils/requireAdmin";
import { normalizeStatus } from "@/lib/tripStatus";
import { riderTripMessage } from "@/lib/push";
import { sendPushToUser } from "@/utils/pushServer";
import { mirrorTripToRtdb } from "@/utils/tripMirror";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (await isRateLimited(adminDb(), `pushnotify_${user.uid}`, 60, 60)) {
    return NextResponse.json({ message: "Too many requests. Please wait a minute and try again." }, { status: 429 });
  }

  let tripId = "";
  try {
    tripId = String((await req.json())?.tripId ?? "");
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }
  if (!tripId) return NextResponse.json({ message: "tripId is required" }, { status: 400 });

  try {
    const tripRef = adminDb().collection("pickupRequests").doc(tripId);
    const trip = (await tripRef.get()).data();
    if (!trip) return NextResponse.json({ message: "Trip not found" }, { status: 404 });
    if (trip.driverId !== user.uid && !isAdminUser(user)) return NextResponse.json({ message: "Not your trip" }, { status: 403 });

    // The driver just moved the trip on: bring the Realtime Database copy up to date too.
    await mirrorTripToRtdb(tripId);

    const message = riderTripMessage(trip.status);
    const status = normalizeStatus(trip.status);
    if (!message || !trip.userId) return NextResponse.json({ sent: 0 });
    if (trip.pushNotified?.[status]) return NextResponse.json({ sent: 0 });

    // Claim this step first so two quick calls can't both push.
    await tripRef.update({ [`pushNotified.${status}`]: FieldValue.serverTimestamp() });
    try {
      const base = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
      const sent = await sendPushToUser(trip.userId, { ...message, link: `${base}/trips/tracking?tripId=${tripId}`, tag: `trip-${tripId}` });
      return NextResponse.json({ sent });
    } catch (err) {
      // A failed send must not use up the step, so the next call can try again.
      await tripRef.update({ [`pushNotified.${status}`]: FieldValue.delete() }).catch(() => {});
      throw err;
    }
  } catch (err) {
    console.error("push notify-trip failed:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
