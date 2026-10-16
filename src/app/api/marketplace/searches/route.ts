// app/api/marketplace/searches/route.ts
// Counts what buyers search for. The buyer must be signed in (so it can't be spammed anonymously)
// but who they are is never written down: only the term is counted.
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuth } from "@/utils/requireAuth";
import { adminDb } from "@/utils/firebaseAdmin";
import { isRateLimited } from "@/utils/rateLimit";
import { SEARCHES_COLLECTION, dayKey, normalizeTerm } from "@/lib/marketplaceSearchStats";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }
  const term = normalizeTerm(body?.term);
  // Not worth recording (too short or looks personal): succeed quietly so the page isn't affected.
  if (!term) return NextResponse.json({ ok: true });
  const found = typeof body?.resultCount === "number" && body.resultCount > 0;

  try {
    const db = adminDb();
    // The limiter key uses the uid, but that lives in a server-only collection; the counts below don't.
    if (await isRateLimited(db, `search_${user.uid}`, 30, 600)) {
      return NextResponse.json({ message: "Too many searches" }, { status: 429 });
    }
    const now = Date.now();
    const id = createHash("sha1").update(term).digest("hex").slice(0, 20);
    await db.collection(SEARCHES_COLLECTION).doc(id).set(
      {
        term,
        count: FieldValue.increment(1),
        zeroResults: FieldValue.increment(found ? 0 : 1),
        daily: { [dayKey(now)]: FieldValue.increment(1) },
        lastAt: now,
      },
      { merge: true }
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error recording search:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
