// app/api/admin/marketplace/reviews/route.ts
// Admin-only moderation of product reviews. Hiding or deleting a review takes its rating out
// of the product's average; restoring it puts the rating back.
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/utils/requireAdmin";
import { adminDb } from "@/utils/firebaseAdmin";
import { MARKET_LISTINGS, toMillis } from "@/lib/marketplace";
import { REVIEWS_COLLECTION, withRating, withoutRating } from "@/lib/marketplaceReviews";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ message: "Admins only" }, { status: 403 });
  try {
    const db = adminDb();
    const snap = await db.collection(REVIEWS_COLLECTION).orderBy("createdAt", "desc").limit(100).get();
    const titles = new Map<string, string>();
    await Promise.all(
      [...new Set(snap.docs.map((d) => d.data().listingId as string))].map(async (id) => {
        titles.set(id, (await db.collection(MARKET_LISTINGS).doc(id).get()).data()?.title ?? "(item removed)");
      })
    );
    return NextResponse.json({
      reviews: snap.docs.map((d) => {
        const r = d.data();
        return {
          id: d.id,
          listingId: r.listingId,
          title: titles.get(r.listingId) ?? "",
          rating: r.rating,
          comment: r.comment ?? "",
          name: r.name ?? "Customer",
          hidden: r.hidden === true,
          createdAt: toMillis(r.createdAt),
        };
      }),
    });
  } catch (err) {
    console.error("Error loading reviews for admin:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ message: "Admins only" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }
  const reviewId = typeof body?.reviewId === "string" ? body.reviewId : "";
  const action = body?.action;
  if (!reviewId || !["hide", "show", "delete"].includes(action)) {
    return NextResponse.json({ message: "reviewId and a valid action are required" }, { status: 400 });
  }

  try {
    const db = adminDb();
    const reviewRef = db.collection(REVIEWS_COLLECTION).doc(reviewId);
    const found = await db.runTransaction(async (tx) => {
      const review = await tx.get(reviewRef);
      if (!review.exists) return false;
      const r = review.data()!;
      const listingRef = db.collection(MARKET_LISTINGS).doc(r.listingId);
      const listing = await tx.get(listingRef);
      const wasCounted = r.hidden !== true;
      const rating = Number(r.rating) || 0;
      const sum = Number(listing.data()?.ratingSum) || 0;
      const count = Number(listing.data()?.ratingCount) || 0;

      let totals = { sum, count };
      if (action === "hide" && wasCounted) totals = withoutRating(sum, count, rating);
      if (action === "delete" && wasCounted) totals = withoutRating(sum, count, rating);
      if (action === "show" && !wasCounted) totals = withRating(sum, count, rating);

      if (action === "delete") tx.delete(reviewRef);
      else tx.update(reviewRef, { hidden: action === "hide", moderatedAt: FieldValue.serverTimestamp(), moderatedBy: admin.email });
      if (listing.exists) tx.update(listingRef, { ratingSum: totals.sum, ratingCount: totals.count });
      return true;
    });
    if (!found) return NextResponse.json({ message: "Review not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error moderating review:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
