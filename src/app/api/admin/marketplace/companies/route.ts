// app/api/admin/marketplace/companies/route.ts
// Admin-only: create or update a MarketPortal selling company.
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/utils/requireAdmin";
import { adminDb } from "@/utils/firebaseAdmin";
import { MARKET_COMPANIES, MARKET_LISTINGS, MARKET_PICKUP } from "@/lib/marketplace";
import { parseSellerInput } from "@/lib/marketplaceSeller";
import { TERMS_VERSION } from "@/lib/marketplaceTerms";

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ message: "Admins only" }, { status: 403 });
  }

  let b: any;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  // Admins confirm the company accepted the Seller Terms when creating it (not when editing).
  const parsed = parseSellerInput(b, { requireTerms: !b.id });
  if ("error" in parsed) {
    const message = parsed.error === "Seller name is required." ? "Company name is required."
      : parsed.error.startsWith("Accept the Seller Terms") ? "Confirm the company has accepted the Seller Terms." : parsed.error;
    return NextResponse.json({ message }, { status: 400 });
  }
  const data = { ...parsed.data, active: b.active !== false, updatedAt: FieldValue.serverTimestamp() };

  try {
    const col = adminDb().collection(MARKET_COMPANIES);
    if (b.id) {
      const ref = col.doc(String(b.id));
      if (!(await ref.get()).exists) return NextResponse.json({ message: "Company not found" }, { status: 404 });
      await ref.update(data);
      await syncCompanyListings(ref.id, data);
      return NextResponse.json({ id: ref.id });
    }
    const ref = col.doc();
    await ref.set({
      ...data,
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ id: ref.id });
  } catch (err) {
    console.error("Error saving marketplace company:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

// Each listing keeps its own copy of the store name, area and private pickup details,
// so editing a company has to carry the change through to its listings.
async function syncCompanyListings(
  companyId: string,
  c: { name: string; area: string; address: string; lat: number; lng: number; phone: string }
) {
  const db = adminDb();
  const listings = await db.collection(MARKET_LISTINGS).where("companyId", "==", companyId).get();
  // A batch holds 500 writes and each listing needs two.
  for (let i = 0; i < listings.docs.length; i += 200) {
    const batch = db.batch();
    for (const d of listings.docs.slice(i, i + 200)) {
      batch.update(d.ref, { sellerName: c.name, location: c.area });
      batch.set(
        db.collection(MARKET_PICKUP).doc(d.id),
        { address: c.address, lat: c.lat, lng: c.lng, phone: c.phone },
        { merge: true }
      );
    }
    await batch.commit();
  }
}
