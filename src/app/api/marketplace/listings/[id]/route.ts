// app/api/marketplace/listings/[id]/route.ts
// One listing for the product page and cart, without the company's price or the markup.
// Items still waiting for review (or rejected) are only shown to admins.
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/requireAuth";
import { isAdminUser } from "@/utils/requireAdmin";
import { adminDb } from "@/utils/firebaseAdmin";
import { MARKET_LISTINGS } from "@/lib/marketplace";
import { publicListingData } from "@/lib/marketplacePublic";
import { releaseExpiredOrdersThrottled } from "@/utils/marketplaceStock";

const HIDDEN_STATUSES = ["pending", "rejected"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await releaseExpiredOrdersThrottled(adminDb()); // so an abandoned checkout's stock is back before we read it
    const snap = await adminDb().collection(MARKET_LISTINGS).doc(id).get();
    const data = snap.data();
    if (!data || (HIDDEN_STATUSES.includes(data.status) && !isAdminUser(user))) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ listing: publicListingData(data) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("Error loading marketplace listing:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
