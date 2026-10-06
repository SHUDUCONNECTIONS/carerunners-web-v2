"use client";
import { authedFetch } from "./authedFetch";

// Tells the server a MarketPortal delivery has moved on so it can email the buyer. A failure here never
// blocks the driver: the trip has already been updated.
export function notifyOrderStatus(tripId: string) {
  authedFetch("/api/marketplace/notify-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tripId }),
  }).catch(() => {});
}
