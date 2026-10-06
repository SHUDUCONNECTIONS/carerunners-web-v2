// app/api/marketplace/quote/route.ts
// Delivery quote for a MarketPortal item. The seller's exact pickup
// coordinates are private, so the buyer's browser can't compute this itself.
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/requireAuth";
import { adminDb } from "@/utils/firebaseAdmin";
import { MARKET_PICKUP, deliveryFeeForKm } from "@/lib/marketplace";
import { getMarketSettings } from "@/utils/marketplaceSettings";
import { deliveryCharge } from "@/lib/marketplaceSettings";
import { drivingDistanceKm } from "@/utils/drivingDistance";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const listingId = params.get("listingId");
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  if (!listingId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ message: "listingId, lat and lng are required" }, { status: 400 });
  }

  try {
    const snap = await adminDb().collection(MARKET_PICKUP).doc(listingId).get();
    if (!snap.exists) return NextResponse.json({ message: "Item not found" }, { status: 404 });
    const pickup = snap.data()!;

    const km = await drivingDistanceKm({ lat: pickup.lat, lng: pickup.lng }, { lat, lng });
    // `subtotal` (the buyer's item total) only decides whether a delivery discount applies; the
    // real price is always worked out again when the order is placed.
    const subtotal = Number(params.get("subtotal")) || 0;
    const fee = deliveryFeeForKm(km);
    const d = deliveryCharge(await getMarketSettings(adminDb()), subtotal, fee);
    return NextResponse.json({ km, fee, subsidy: d.subsidy, charged: d.charged });
  } catch (err) {
    console.error("Error quoting marketplace delivery:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
