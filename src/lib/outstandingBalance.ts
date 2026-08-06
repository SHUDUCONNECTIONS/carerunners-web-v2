import { db } from "@/utils/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export interface OutstandingTrip {
  id: string;
  price: string;
  [key: string]: any;
}

export interface OutstandingBalance {
  trips: OutstandingTrip[];
  total: number;
}

// A trip only counts against a customer once it's actually been delivered —
// unpaid trips still in progress (or cancelled ones) aren't a debt yet, so
// this always narrows to status === "completed" on top of the payment_status
// filter. Shared by the dashboard's balance card, the billing page, and the
// booking-wizard's pre-request gate so all three agree on what "outstanding"
// means.
export async function fetchOutstandingBalance(userId: string): Promise<OutstandingBalance> {
  const q = query(
    collection(db, "pickupRequests"),
    where("userId", "==", userId),
    where("payment_status", "in", ["unpaid", "failed"])
  );
  const snapshot = await getDocs(q);
  const trips: OutstandingTrip[] = snapshot.docs
    .filter((d) => d.data().status === "completed")
    .map((d) => ({ id: d.id, ...d.data() } as OutstandingTrip));
  const total = trips.reduce((sum, t) => sum + parseFloat(t.price || "0"), 0);
  return { trips, total };
}
