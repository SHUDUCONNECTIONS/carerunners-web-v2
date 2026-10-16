// app/api/marketplace/orders/route.ts
// The signed-in buyer's own orders (or one of them, with ?id=), without the company's price,
// the markup or payout details.
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/requireAuth";
import { adminDb } from "@/utils/firebaseAdmin";
import { MARKET_ORDERS } from "@/lib/marketplace";
import { publicOrderData } from "@/lib/marketplacePublic";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  const orders = adminDb().collection(MARKET_ORDERS);
  try {
    const docs = id
      ? [await orders.doc(id).get()].filter((d) => d.exists && d.data()!.buyerId === user.uid)
      : (await orders.where("buyerId", "==", user.uid).get()).docs;
    if (id && docs.length === 0) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json(
      { orders: docs.map((d) => ({ ...publicOrderData(d.data()!), id: d.id })) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    console.error("Error loading marketplace orders:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
