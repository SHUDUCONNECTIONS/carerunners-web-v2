// app/api/admin/marketplace/bulk/route.ts
// Admin-only: change company prices and stock on many listings at once.
// The customer price is always company price + the standard markup, worked out here, never sent by the browser.
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/utils/requireAdmin";
import { adminDb } from "@/utils/firebaseAdmin";
import { MARKET_LISTINGS } from "@/lib/marketplace";
import { validateChange, type BulkChange as Change } from "@/lib/marketplaceBulk";
import { priceWithMarkup } from "@/lib/marketplaceMarkup";

const MAX_CHANGES = 400;

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ message: "Admins only" }, { status: 403 });
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }
  const raw = Array.isArray(body?.changes) ? body.changes : [];
  if (raw.length === 0 || raw.length > MAX_CHANGES) {
    return NextResponse.json({ message: `Send between 1 and ${MAX_CHANGES} changes at a time.` }, { status: 400 });
  }
  const changes: Change[] = [];
  for (const r of raw) {
    const v = validateChange(r);
    if ("error" in v) return NextResponse.json({ message: v.error }, { status: 400 });
    changes.push(v.change);
  }

  try {
    const db = adminDb();
    const snaps = await db.getAll(...changes.map((c) => db.collection(MARKET_LISTINGS).doc(c.id)));
    const batch = db.batch();
    let updated = 0;
    const skipped: string[] = [];
    snaps.forEach((snap, i) => {
      const c = changes[i];
      const l = snap.data();
      if (!snap.exists || !l) {
        skipped.push(c.id);
        return;
      }
      const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
      if (c.companyPrice !== undefined) {
        update.askingPrice = c.companyPrice;
        Object.assign(update, priceWithMarkup(c.companyPrice));
      }
      // Stock only applies to items sold by quantity. Restocking a sold-out item puts it back on sale.
      if (c.stock !== undefined && typeof l.stock === "number") {
        update.stock = c.stock;
        if (c.stock > 0 && l.status === "sold") update.status = "active";
      }
      batch.update(snap.ref, update);
      updated++;
    });
    await batch.commit();
    return NextResponse.json({ updated, skipped });
  } catch (err) {
    console.error("Error saving bulk listing changes:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
