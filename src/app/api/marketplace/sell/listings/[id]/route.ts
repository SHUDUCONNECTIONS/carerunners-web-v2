// app/api/marketplace/sell/listings/[id]/route.ts
// A customer seller managing one of their own items.
//   PATCH { action: "takedown" }: withdraw an item awaiting review, or take a live item off sale (e.g. sold
//     elsewhere). Not while a buyer is paying for it, and not once it is sold.
//   PUT (the item form): correct an item that was rejected, withdrawn or taken down, and send it back for
//     review. It is hidden from buyers until an admin approves it again.
// Items an admin took down stay down: only the seller's own take-downs can be resubmitted.
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuth } from "@/utils/requireAuth";
import { adminDb } from "@/utils/firebaseAdmin";
import { isRateLimited } from "@/utils/rateLimit";
import { sendAdminItemSubmitted } from "@/utils/email";
import { isOwnPhoto, parseListingInput } from "@/utils/marketplaceListing";
import { MARKET_COMPANIES, MARKET_LISTINGS, reservationActive } from "@/lib/marketplace";
import { customerSellerId } from "@/lib/marketplaceSeller";

type Ctx = { params: Promise<{ id: string }> };

// The caller's own item, or a response explaining why not.
async function ownItem(req: NextRequest, ctx: Ctx) {
  const user = await requireAuth(req);
  if (!user) return { res: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  const db = adminDb();
  if (await isRateLimited(db, `sellEdit_${user.uid}`, 30, 3600)) {
    return { res: NextResponse.json({ message: "Too many changes. Please try again in an hour." }, { status: 429 }) };
  }
  const { id } = await ctx.params;
  const ref = db.collection(MARKET_LISTINGS).doc(String(id));
  const snap = await ref.get();
  const item = snap.data();
  if (!snap.exists || !item || item.companyId !== customerSellerId(user.uid)) {
    return { res: NextResponse.json({ message: "Item not found" }, { status: 404 }) };
  }
  return { user, db, ref, item };
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const own = await ownItem(req, ctx);
    if ("res" in own) return own.res;
    let b: any;
    try {
      b = await req.json();
    } catch {
      return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
    }
    if (b?.action !== "takedown") return NextResponse.json({ message: "Unknown action" }, { status: 400 });

    const { item, ref } = own;
    const reservedAt = item.reservedAt?.toMillis?.() ?? (Number(item.reservedAt) || 0);
    if (item.status === "reserved" && reservationActive({ status: item.status, reservedAt })) {
      return NextResponse.json(
        { message: "A buyer is paying for this item right now, so it can't be taken down. Please contact Care Runners support." },
        { status: 409 }
      );
    }
    if (!["pending", "active", "reserved"].includes(item.status)) {
      return NextResponse.json(
        { message: item.status === "sold" ? "This item has already been sold. Please contact Care Runners support." : "This item isn't on sale." },
        { status: 409 }
      );
    }
    await ref.update({ status: "inactive", sellerRemoved: true, updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ status: "inactive" });
  } catch (err) {
    console.error("Error taking down a customer item:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const own = await ownItem(req, ctx);
    if ("res" in own) return own.res;
    const { user, db, ref, item } = own;
    if (!user.emailVerified) {
      return NextResponse.json({ message: "Verify your email address before you start selling." }, { status: 403 });
    }
    const editable = item.status === "pending" || item.status === "rejected" || (item.status === "inactive" && item.sellerRemoved === true);
    if (!editable) {
      return NextResponse.json(
        { message: item.status === "active" ? "Take the item down first, then edit it." : "This item can't be changed. Please contact Care Runners support." },
        { status: 409 }
      );
    }

    let b: any;
    try {
      b = await req.json();
    } catch {
      return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
    }
    const parsed = parseListingInput({ ...b, stock: undefined }, { admin: false });
    if ("error" in parsed) return NextResponse.json({ message: parsed.error }, { status: 400 });
    const kept = new Set<string>(item.images ?? []);
    if (!parsed.data.images.every((url) => kept.has(url) || isOwnPhoto(url, user.uid))) {
      return NextResponse.json({ message: "Upload the photos from this page." }, { status: 400 });
    }
    const seller = (await db.collection(MARKET_COMPANIES).doc(item.companyId).get()).data();
    if (!seller || seller.active === false) {
      return NextResponse.json({ message: "Your seller account is paused. Please contact Care Runners support." }, { status: 403 });
    }

    const d = parsed.data;
    await ref.update({
      title: d.title,
      description: d.description,
      category: d.category,
      condition: d.condition,
      defects: d.defects,
      knownIssues: d.knownIssues,
      specifications: d.specifications,
      additionalInfo: d.additionalInfo,
      askingPrice: d.companyPrice,
      images: d.images,
      // Back to review, priced again when approved.
      status: "pending",
      markupAmount: null,
      sellingPrice: null,
      rejectionReason: FieldValue.delete(),
      sellerRemoved: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await sendAdminItemSubmitted({
      title: d.title,
      sellerName: seller.name,
      sellerEmail: user.email,
      price: d.companyPrice,
      photos: d.images.length,
      resubmitted: true,
      origin: process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin,
    });
    return NextResponse.json({ id: ref.id });
  } catch (err) {
    console.error("Error resubmitting a customer item:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
