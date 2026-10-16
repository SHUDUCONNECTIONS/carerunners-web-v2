"use client";
import { authedFetch } from "./authedFetch";

// Tells the server a delivery has moved on so it can alert the rider (push) and, for MarketPortal orders, email the
// buyer. A failure here never blocks the driver: the trip has already been updated.
export function notifyOrderStatus(tripId: string) {
  for (const url of ["/api/marketplace/notify-status", "/api/push/notify-trip"]) {
    authedFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId }),
    }).catch(() => {});
  }
}
