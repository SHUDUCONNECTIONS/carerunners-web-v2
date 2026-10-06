// app/api/marketplace/reviews/route.ts
// Product ratings. Only someone whose paid order for the product has been delivered can rate
// it, once per product (they can change it later). Reviews are written here, never from the
// browser, so a rating can't be faked and the average on the listing stays correct.
import { NextRequest, NextResponse } from "next/server";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { requireAuth } from "@/utils/requireAuth";
import { adminDb } from "@/utils/firebaseAdmin";
import { MARKET_LISTINGS, MARKET_ORDERS, orderLines, toMillis } from "@/lib/marketplace";
import { isRateLimited } from "@/utils/rateLimit";
import { REVIEWS_COLLECTION, applyRating, parseReview, publicName, type ReviewView } from "@/lib/marketplaceReviews";

const DELIVERED = ["delivered", "completed"];

// True if this buyer has a paid order containing the listing and the delivery has arrived.
async function hasReceived(db: Firestore, uid: string, listingId: string): Promise<boolean> {
  const orders = await db.collection(MARKET_ORDERS).where("buyerId", "==", uid).get();
  for (const o of orders.docs) {
    const data = o.data();
    if (data.status !== "paid" || !orderLines(data as any).some((l) => l.listingId === listingId)) continue;
    const trip = data.tripId ? await db.collection("pickupRequests").doc(data.tripId).get() : null;
    if (trip?.exists && DELIVERED.includes(trip.data()!.status)) return true;
  }
  return false;
}

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const listingId = req.nextUrl.searchParams.get("listingId");
  if (!listingId) return NextResponse.json({ message: "listingId is required" }, { status: 400 });

  try {
    const db = adminDb();
    const snap = await db.collection(REVIEWS_COLLECTION).where("listingId", "==", listingId).get();
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
    // Reviews hidden by an admin are not shown to the public (the writer still sees their own).
    const reviews: ReviewView[] = all
      .filter((r) => r.hidden !== true)
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
      .slice(0, 20)
      .map((r) => ({ rating: r.rating, comment: r.comment ?? "", name: r.name ?? "Customer", createdAt: toMillis(r.createdAt) }));
    const mine = all.find((r) => r.userId === user.uid);
    return NextResponse.json({
      reviews,
      mine: mine ? { rating: mine.rating, comment: mine.comment ?? "", hidden: mine.hidden === true } : null,
      canReview: await hasReceived(db, user.uid, listingId),
    });
  } catch (err) {
    console.error("Error loading reviews:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }
  const listingId = typeof body?.listingId === "string" ? body.listingId : "";
  const parsed = parseReview(body);
  if (!listingId) return NextResponse.json({ message: "listingId is required" }, { status: 400 });
  if ("error" in parsed) return NextResponse.json({ message: parsed.error }, { status: 400 });

  try {
    const db = adminDb();
    if (await isRateLimited(db, `review_${user.uid}`, 10, 60)) {
      return NextResponse.json({ message: "Too many requests. Please wait a minute." }, { status: 429 });
    }
    if (!(await hasReceived(db, user.uid, listingId))) {
      return NextResponse.json({ message: "You can rate an item once your delivery has arrived." }, { status: 403 });
    }
    const name = publicName((await db.collection("users").doc(user.uid).get()).data()?.name ?? user.email?.split("@")[0]);
    const reviewRef = db.collection(REVIEWS_COLLECTION).doc(`${listingId}_${user.uid}`);
    const listingRef = db.collection(MARKET_LISTINGS).doc(listingId);

    const missing = await db.runTransaction(async (tx) => {
      const [review, listing] = await Promise.all([tx.get(reviewRef), tx.get(listingRef)]);
      if (!listing.exists) return true;
      const sum = Number(listing.data()!.ratingSum) || 0;
      const count = Number(listing.data()!.ratingCount) || 0;
      // A review an admin has hidden is not in the totals, so editing it must not change them.
      const totals =
        review.exists && review.data()!.hidden === true
          ? { sum, count }
          : applyRating(sum, count, review.exists ? Number(review.data()!.rating) : null, parsed.rating);
      tx.set(
        reviewRef,
        {
          listingId,
          userId: user.uid,
          name,
          rating: parsed.rating,
          comment: parsed.comment,
          updatedAt: FieldValue.serverTimestamp(),
          ...(review.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
        },
        { merge: true }
      );
      tx.update(listingRef, { ratingSum: totals.sum, ratingCount: totals.count });
      return false;
    });
    if (missing) return NextResponse.json({ message: "Item not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error saving review:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
