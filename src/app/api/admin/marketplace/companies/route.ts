// app/api/admin/marketplace/companies/route.ts
// Admin-only: create or update a MarketPortal selling company.
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/utils/requireAdmin";
import { adminDb } from "@/utils/firebaseAdmin";
import { MARKET_COMPANIES, MARKET_LISTINGS, MARKET_PICKUP, SA_BANKS } from "@/lib/marketplace";
import { TERMS_VERSION } from "@/lib/marketplaceTerms";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const bank = b.bank ?? {};
  const loginEmails: string[] = Array.from(
    new Set((Array.isArray(b.loginEmails) ? b.loginEmails : []).map((e: unknown) => str(e).toLowerCase()).filter(Boolean))
  );

  const lat = Number(b.lat);
  const lng = Number(b.lng);
  const bankInfo = SA_BANKS.find((x) => x.id === bank.bankId);

  const problem =
    !str(b.name) ? "Company name is required."
    : !str(b.contactName) ? "Contact person is required."
    : str(b.phone).replace(/\D/g, "").length < 9 ? "A valid phone number is required."
    : !str(b.address) || !Number.isFinite(lat) || !Number.isFinite(lng) ? "Choose the pickup address from the suggestions."
    : !str(bank.accountHolder) || !bankInfo || !/^\d{6,16}$/.test(str(bank.accountNumber)) ? "Complete the bank details (account number 6 to 16 digits)."
    : loginEmails.some((e) => !EMAIL.test(e)) ? "One of the login emails is not valid."
    : !b.id && b.termsAccepted !== true ? "Confirm the company has accepted the Seller Terms."
    : "";
  if (problem) return NextResponse.json({ message: problem }, { status: 400 });

  const data = {
    name: str(b.name),
    contactName: str(b.contactName),
    contactEmail: str(b.contactEmail).toLowerCase(),
    phone: str(b.phone),
    address: str(b.address),
    area: str(b.area) || str(b.address),
    lat,
    lng,
    bank: {
      accountHolder: str(bank.accountHolder),
      bankId: bankInfo!.id,
      accountNumber: str(bank.accountNumber),
      accountType: bank.accountType === "cheque" ? "cheque" : "savings",
      branchCode: bankInfo!.branchCode,
    },
    loginEmails,
    active: b.active !== false,
    updatedAt: FieldValue.serverTimestamp(),
  };

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
