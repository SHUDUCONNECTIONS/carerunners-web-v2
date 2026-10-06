// app/api/marketplace/settings/route.ts
// The settings buyers need to see ("minimum order R200", "delivery discount over R500").
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/requireAuth";
import { adminDb } from "@/utils/firebaseAdmin";
import { getMarketSettings } from "@/utils/marketplaceSettings";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await getMarketSettings(adminDb()));
  } catch (err) {
    console.error("Error loading marketplace settings:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
