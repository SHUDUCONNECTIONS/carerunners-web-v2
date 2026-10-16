// src/utils/province.ts
// Server-only. Which South African province a place is in, from Google's Geocoding API. MarketPortal
// uses it to decide whether a long delivery stays with our drivers (same province) or goes by courier.
import type { LatLng } from "@/lib/marketplace";
import { serverMapsKey } from "./googleMapsServer";

export type Place = LatLng | string;

// The province name ("Gauteng"), or null if Google can't be reached or doesn't know.
export async function provinceOf(place: Place): Promise<string | null> {
  const key = serverMapsKey();
  if (!key) return null;
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    if (typeof place === "string") url.searchParams.set("address", place);
    else url.searchParams.set("latlng", `${place.lat},${place.lng}`);
    url.searchParams.set("region", "za");
    url.searchParams.set("key", key);
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    for (const result of data?.results ?? []) {
      const area = result.address_components?.find((c: any) => c.types?.includes("administrative_area_level_1"));
      if (area?.long_name) return area.long_name;
    }
    console.warn("Geocoding gave no province:", data?.status);
  } catch (err) {
    console.warn("Geocoding failed:", err);
  }
  return null;
}

// true/false when both provinces are known, null when either lookup failed.
export async function inSameProvince(a: Place, b: Place): Promise<boolean | null> {
  const [pa, pb] = await Promise.all([provinceOf(a), provinceOf(b)]);
  return pa && pb ? pa === pb : null;
}
