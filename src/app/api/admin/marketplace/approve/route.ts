// app/api/admin/marketplace/approve/route.ts
// Admin-only: put an item a company submitted on sale. Its customer price is the company price
// plus the standard markup, worked out here (the browser can't set listing prices).
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/utils/requireAdmin";
import { adminDb } from "@/utils/firebaseAdmin";
import { MARKET_LISTINGS } from "@/lib/marketplace";
import { priceWithMarkup } from "@/lib/marketplaceMarkup";

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ message: "Admins only" }, { status: 403 });

  let listingId = "";
  try {
    listingId = String((await req.json())?.listingId ?? "");
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }
  if (!listingId) return NextResponse.json({ message: "listingId is required" }, { status: 400 });

  try {
    const ref = adminDb().collection(MARKET_LISTINGS).doc(listingId);
    const listing = (await ref.get()).data();
    if (!listing) return NextResponse.json({ message: "Item not found" }, { status: 404 });
    if (listing.status !== "pending") return NextResponse.json({ message: "This item isn't waiting for review." }, { status: 409 });
    const companyPrice = Number(listing.askingPrice);
    if (!Number.isFinite(companyPrice) || companyPrice <= 0) {
      return NextResponse.json({ message: "This item has no valid company price." }, { status: 409 });
    }

    const priced = priceWithMarkup(companyPrice);
    await ref.update({ status: "active", ...priced, updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json(priced);
  } catch (err) {
    console.error("Error approving marketplace listing:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
