// The booking page also writes each trip to the Realtime Database (trips/{id}), but only once, when it is
// booked ("awaiting-payment"). Firestore (pickupRequests/{id}) is the real record; this copies its progress
// across so the Realtime Database copy doesn't stay stuck on "awaiting payment". Called by the server after
// payment, cancellation and each driver step that goes through /api/push/notify-trip.
// scripts/sync-rtdb-trips.mjs brings older copies up to date.
import { adminDb, adminRtdb } from "@/utils/firebaseAdmin";

// The fields that change after booking.
export const MIRRORED_FIELDS = ["status", "payment_status", "driverId"] as const;

export function mirrorPatch(trip: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const f of MIRRORED_FIELDS) patch[f] = trip[f] ?? null; // null removes the field
  return patch;
}

// Never throws: the copy is secondary, and a failure here must not fail a payment or a cancellation.
export async function mirrorTripToRtdb(tripId: string): Promise<void> {
  try {
    const ref = adminRtdb().ref(`trips/${tripId}`);
    if (!(await ref.once("value")).exists()) return; // only trips booked with a copy
    const trip = (await adminDb().collection("pickupRequests").doc(tripId).get()).data();
    if (trip) await ref.update(mirrorPatch(trip));
  } catch (err) {
    console.error(`Couldn't update the Realtime Database copy of trip ${tripId}:`, err);
  }
}
