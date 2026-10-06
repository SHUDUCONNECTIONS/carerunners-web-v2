// src/utils/drivingDistance.ts
// Server-only. Real driving distance from Google's Distance Matrix, the same
// source the trip request page uses, so a MarketPortal delivery is priced like
// any other Care Runners parcel delivery. Falls back to the straight-line
// estimate if Google can't be reached, so checkout never breaks on it.
import { estimateDeliveryKm, type LatLng } from "@/lib/marketplace";

export async function drivingDistanceKm(from: LatLng, to: LatLng): Promise<number> {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (key) {
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
      url.searchParams.set("origins", `${from.lat},${from.lng}`);
      url.searchParams.set("destinations", `${to.lat},${to.lng}`);
      url.searchParams.set("mode", "driving");
      url.searchParams.set("units", "metric");
      url.searchParams.set("key", key);
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      const data = await res.json();
      const el = data?.rows?.[0]?.elements?.[0];
      if (res.ok && el?.status === "OK" && Number.isFinite(el.distance?.value)) {
        return Number((el.distance.value / 1000).toFixed(2));
      }
      console.warn("Distance Matrix gave no route, using estimate:", data?.status, el?.status);
    } catch (err) {
      console.warn("Distance Matrix failed, using estimate:", err);
    }
  }
  return estimateDeliveryKm(from, to);
}
