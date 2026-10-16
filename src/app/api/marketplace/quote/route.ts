// app/api/marketplace/quote/route.ts
// Delivery-area check for a MarketPortal item. The seller's exact pickup
// coordinates are private, so the buyer's browser can't compute this itself.
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/requireAuth";
import { adminDb } from "@/utils/firebaseAdmin";
import { isRateLimited } from "@/utils/rateLimit";
import { MARKET_PICKUP } from "@/lib/marketplace";
import { COURIER_FEE, deliveryZone, driveMinutes, driveSurcharge, needsProvinceCheck } from "@/lib/marketplaceDeliveryDay";
import { drivingRoute } from "@/utils/drivingDistance";
import { inSameProvince } from "@/utils/province";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (await isRateLimited(adminDb(), `quote_${user.uid}`, 30, 60)) {
    return NextResponse.json({ message: "Too many quote requests. Please wait a minute and try again." }, { status: 429 });
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

    const from = { lat: pickup.lat, lng: pickup.lng };
    const route = await drivingRoute(from, { lat, lng });
    const drive = driveMinutes(route.km, route.minutes);
    // Our drivers deliver within the province and up to a few hours into other provinces, priced by the
    // delivery day the buyer picks plus a drive-time surcharge. Further than that, another courier.
    const sameProvince = needsProvinceCheck(drive) ? await inSameProvince(from, { lat, lng }) : null;
    const zone = deliveryZone(drive, sameProvince);
    return NextResponse.json({
      km: route.km,
      zone,
      surcharge: zone === "driver" ? driveSurcharge(drive) : 0,
      courierFee: zone === "courier" ? COURIER_FEE : null,
    });
  } catch (err) {
    console.error("Error quoting marketplace delivery:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
