// app/api/marketplace/sell/route.ts
// A customer selling their own items on MarketPortal.
//   GET:  their seller account (if they have one), for the Sell page.
//   POST: create or update it (name shown to buyers, pickup address, bank details for payouts).
// The account is a MarketPortal company like the ones admins set up (id seller-<uid>, the customer's verified
// email as its login), so pickups, payouts and the seller's view in My MarketPortal work the same way.
// Items are submitted through /api/marketplace/sell/listings and wait for an admin to approve them.
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuth } from "@/utils/requireAuth";
import { adminDb } from "@/utils/firebaseAdmin";
import { isRateLimited } from "@/utils/rateLimit";
import { MARKET_COMPANIES, MARKET_LISTINGS, MARKET_PICKUP, SA_BANKS } from "@/lib/marketplace";
import { customerSellerId, parseSellerInput } from "@/lib/marketplaceSeller";
import { TERMS_VERSION } from "@/lib/marketplaceTerms";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const snap = await adminDb().collection(MARKET_COMPANIES).doc(customerSellerId(user.uid)).get();
    const c = snap.data();
    return NextResponse.json({
      emailVerified: user.emailVerified,
      seller: snap.exists && c
        ? {
            id: snap.id,
            name: c.name,
            contactName: c.contactName,
            phone: c.phone,
            address: c.address,
            area: c.area,
            active: c.active !== false,
            // Enough to recognise the account, not the full number.
            bank: `${SA_BANKS.find((b) => b.id === c.bank?.bankId)?.label ?? "Bank"} ····${String(c.bank?.accountNumber ?? "").slice(-4)}`,
          }
        : null,
    });
  } catch (err) {
    console.error("Error loading seller account:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  // The seller's view of their items and sales (My MarketPortal) is limited to verified emails.
  if (!user.emailVerified || !user.email) {
    return NextResponse.json({ message: "Verify your email address before you start selling." }, { status: 403 });
  }
  const db = adminDb();
  if (await isRateLimited(db, `sellerSave_${user.uid}`, 10, 3600)) {
    return NextResponse.json({ message: "Too many changes. Please try again in an hour." }, { status: 429 });
  }

  let b: any;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const ref = db.collection(MARKET_COMPANIES).doc(customerSellerId(user.uid));
  try {
    const existing = await ref.get();
    // Login emails are never taken from the request: only the customer's own verified email.
    const parsed = parseSellerInput({ ...b, loginEmails: [] }, { requireTerms: !existing.exists });
    if ("error" in parsed) return NextResponse.json({ message: parsed.error }, { status: 400 });
    const data = {
      ...parsed.data,
      contactEmail: user.email.toLowerCase(),
      loginEmails: [user.email.toLowerCase()],
      ownerUid: user.uid,
      kind: "customer",
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (existing.exists) {
      // A seller an admin has switched off stays off.
      await ref.update(data);
      await syncSellerListings(ref.id, data);
    } else {
      await ref.set({
        ...data,
        active: true,
        termsVersion: TERMS_VERSION,
        termsAcceptedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    return NextResponse.json({ id: ref.id });
  } catch (err) {
    console.error("Error saving seller account:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

// Each listing keeps a copy of the seller name, area and private pickup details (as for companies).
async function syncSellerListings(sellerId: string, c: { name: string; area: string; address: string; lat: number; lng: number; phone: string }) {
  const db = adminDb();
  const listings = await db.collection(MARKET_LISTINGS).where("companyId", "==", sellerId).get();
  for (let i = 0; i < listings.docs.length; i += 200) {
    const batch = db.batch();
    for (const d of listings.docs.slice(i, i + 200)) {
      batch.update(d.ref, { sellerName: c.name, location: c.area });
      batch.set(db.collection(MARKET_PICKUP).doc(d.id), { address: c.address, lat: c.lat, lng: c.lng, phone: c.phone }, { merge: true });
    }
    await batch.commit();
  }
}
