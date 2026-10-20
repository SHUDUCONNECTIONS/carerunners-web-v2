// app/api/marketplace/sell/listings/route.ts
// A customer submits one of their own items. It is saved as "pending" with no customer price, and only goes
// live when an admin approves it (/api/admin/marketplace/approve adds the standard markup then).
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/requireAuth";
import { adminDb } from "@/utils/firebaseAdmin";
import { isRateLimited } from "@/utils/rateLimit";
import { createListing, parseListingInput } from "@/utils/marketplaceListing";
import { MARKET_COMPANIES, MARKET_LISTINGS } from "@/lib/marketplace";
import { customerSellerId } from "@/lib/marketplaceSeller";

// Items waiting for review at once, per seller: enough for a real clear-out, not a flood for the admins.
const MAX_PENDING_PER_SELLER = 20;

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!user.emailVerified) {
    return NextResponse.json({ message: "Verify your email address before you start selling." }, { status: 403 });
  }
  const db = adminDb();
  if (await isRateLimited(db, `sellItem_${user.uid}`, 10, 3600)) {
    return NextResponse.json({ message: "You've submitted a lot of items. Please try again in an hour." }, { status: 429 });
  }

  let b: any;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  // Customers always sell one-off items from their own seller account, whatever the request says.
  const parsed = parseListingInput({ ...b, stock: undefined }, { admin: false });
  if ("error" in parsed) return NextResponse.json({ message: parsed.error }, { status: 400 });
  const sellerId = customerSellerId(user.uid);

  try {
    const seller = (await db.collection(MARKET_COMPANIES).doc(sellerId).get()).data();
    if (!seller || seller.ownerUid !== user.uid) {
      return NextResponse.json({ message: "Set up your seller details first." }, { status: 409 });
    }
    if (seller.active === false) {
      return NextResponse.json({ message: "Your seller account is paused. Please contact Care Runners support." }, { status: 403 });
    }
    const pending = await db.collection(MARKET_LISTINGS).where("companyId", "==", sellerId).where("status", "==", "pending").count().get();
    if (pending.data().count >= MAX_PENDING_PER_SELLER) {
      return NextResponse.json(
        { message: `You have ${MAX_PENDING_PER_SELLER} items waiting for review. Please wait for those to be approved first.` },
        { status: 429 }
      );
    }

    const result = await createListing(db, { ...parsed.data, companyId: sellerId, stock: null }, user.uid, "pending");
    if ("error" in result) return NextResponse.json({ message: result.error }, { status: result.status });
    return NextResponse.json({ id: result.id });
  } catch (err) {
    console.error("Error submitting a customer item:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
