// app/api/admin/marketplace/settings/route.ts
// Admin-only: change the MarketPortal minimum order and delivery discount.
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/utils/requireAdmin";
import { adminDb } from "@/utils/firebaseAdmin";
import { SETTINGS_COLLECTION, SETTINGS_DOC, parseSettings } from "@/lib/marketplaceSettings";
import { clearSettingsCache } from "@/utils/marketplaceSettings";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ message: "Admins only" }, { status: 403 });
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }
  const s = parseSettings(body);
  if (s.deliverySubsidyAmount > 0 && s.deliverySubsidyOver <= 0) {
    return NextResponse.json({ message: "Set the order amount that unlocks the delivery discount." }, { status: 400 });
  }
  if (s.minOrderAmount > 0 && s.deliverySubsidyOver > 0 && s.deliverySubsidyOver < s.minOrderAmount) {
    return NextResponse.json({ message: "The discount amount should not be lower than the minimum order." }, { status: 400 });
  }
  try {
    await adminDb().collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC).set({ ...s, updatedAt: FieldValue.serverTimestamp(), updatedBy: admin.email });
    clearSettingsCache();
    return NextResponse.json(s);
  } catch (err) {
    console.error("Error saving marketplace settings:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
