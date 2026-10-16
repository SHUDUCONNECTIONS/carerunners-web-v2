// src/utils/drivingDistance.ts
// Server-only. Real driving distance from Google's Distance Matrix, the same
// source the trip request page uses, so a MarketPortal delivery is priced like
// any other Care Runners parcel delivery.
import { estimateDeliveryKm, type LatLng } from "@/lib/marketplace";
import { serverMapsKey } from "./googleMapsServer";

// A place is either coordinates or an address Google can find. Prices are worked out from the
// address the driver will actually go to, so callers pass the saved address text wherever the
// coordinates came from the browser (otherwise a buyer could send coordinates next to the store
// with a far-away address and pay the shortest-distance fee).
export type Place = LatLng | string;

const asParam = (p: Place) => (typeof p === "string" ? p : `${p.lat},${p.lng}`);

export type Route = { km: number; minutes: number | null };

// Driving distance in km, or null if Google can't be reached or finds no route.
export async function googleDrivingKm(from: Place, to: Place): Promise<number | null> {
  return (await googleDrivingRoute(from, to))?.km ?? null;
}

// Driving distance (km) and one-way driving time (minutes), or null if Google can't be reached or finds no route.
export async function googleDrivingRoute(from: Place, to: Place): Promise<Route | null> {
  const key = serverMapsKey();
  if (!key) return null;
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
    url.searchParams.set("origins", asParam(from));
    url.searchParams.set("destinations", asParam(to));
    url.searchParams.set("mode", "driving");
    url.searchParams.set("units", "metric");
    url.searchParams.set("region", "za");
    url.searchParams.set("key", key);
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    const el = data?.rows?.[0]?.elements?.[0];
    if (res.ok && el?.status === "OK" && Number.isFinite(el.distance?.value)) {
      const seconds = el.duration?.value;
      return {
        km: Number((el.distance.value / 1000).toFixed(2)),
        minutes: Number.isFinite(seconds) ? Math.round(seconds / 60) : null,
      };
    }
    console.warn("Distance Matrix gave no route:", data?.status, el?.status);
  } catch (err) {
    console.warn("Distance Matrix failed:", err);
  }
  return null;
}

// Falls back to the straight-line estimate if Google can't be reached, so a
// quote never breaks on it. Only for coordinates the server trusts.
export async function drivingDistanceKm(from: LatLng, to: LatLng): Promise<number> {
  return (await googleDrivingKm(from, to)) ?? estimateDeliveryKm(from, to);
}

// The same, with the driving time when Google gives one (null otherwise).
export async function drivingRoute(from: LatLng, to: LatLng): Promise<Route> {
  return (await googleDrivingRoute(from, to)) ?? { km: estimateDeliveryKm(from, to), minutes: null };
}
