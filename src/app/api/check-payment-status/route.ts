// app/api/check-payment-status/route.ts
// Server-authoritative payment finalize step. The client used to decide for
// itself (from this endpoint's response) whether to write payment_status:
// 'paid' straight into Firestore — that let anyone skip Peach entirely and
// mark their own trips/plans paid via the browser console. Now this route
// re-checks the checkout with Peach using our credentials and is the only
// thing that writes payment_status, keyed off the checkout record it saved
// during prepare-checkout (never off client-supplied ids/params).
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/requireAuth";
import { adminDb } from "@/utils/firebaseAdmin";
import { getPaymentStatus, isSuccessCode, isPendingCode } from "@/utils/peach";

async function sendConfirmationEmail(
  origin: string,
  checkout: any,
  email: string | null,
  peachResult: any
) {
  if (!email) return;
  const amount = peachResult.amount;
  const date = peachResult.timestamp;
  const brand = peachResult.paymentBrand;

  try {
    if (checkout.type === "plan") {
      await fetch(`${origin}/api/send-plan-confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, amount, date, brand, planName: checkout.plan }),
      });
    } else {
      const customMessage =
        checkout.type === "billing"
          ? `This payment covers ${checkout.requestIds.length} trip${checkout.requestIds.length !== 1 ? "s" : ""}.`
          : undefined;
      await fetch(`${origin}/api/send-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, amount, date, brand, customMessage }),
      });
    }
  } catch (err) {
    console.error("Error sending payment confirmation email:", err);
  }
}

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ message: "Missing or invalid payment ID" }, { status: 400 });
  }

  const db = adminDb();
  const checkoutRef = db.collection("checkouts").doc(id);
  const checkoutSnap = await checkoutRef.get();
  if (!checkoutSnap.exists) {
    return NextResponse.json({ message: "Unknown checkout" }, { status: 404 });
  }
  const checkout = checkoutSnap.data()!;

  if (checkout.uid !== user.uid) {
    return NextResponse.json({ message: "Not your checkout" }, { status: 403 });
  }

  // Terminal states are cached so re-polling (e.g. the status page mounting
  // twice) doesn't re-send confirmation emails or re-run Firestore writes.
  if (checkout.status === "paid" || checkout.status === "failed") {
    return NextResponse.json(checkout.peachResult);
  }

  try {
    const peachResult = await getPaymentStatus(id);
    const code = peachResult?.result?.code;
    const success = isSuccessCode(code);
    const pending = !success && isPendingCode(code);
    const newStatus = success ? "paid" : pending ? "pending" : "failed";

    if (checkout.type === "trip") {
      const update: Record<string, unknown> = { payment_status: newStatus };
      if (success) {
        // Individual accounts create trips gated behind payment (see
        // request/page.tsx, PartsRequestFlow.tsx) — only those need to
        // transition to "pending" (driver-visible) here. Firm trips are
        // already "pending" the moment they're created and get paid later
        // via /billing, so leave their status alone.
        const tripSnap = await db.collection("pickupRequests").doc(checkout.requestId).get();
        if (tripSnap.exists && tripSnap.data()?.status === "awaiting-payment") {
          update.status = "pending";
        }
        // Lets cancel-trip find this payment to refund later without having
        // to search the checkouts collection for it.
        update.checkoutId = id;
      }
      await db.collection("pickupRequests").doc(checkout.requestId).update(update);
    } else if (checkout.type === "plan") {
      await db.collection("firms").doc(checkout.firmId).update({
        paymentStatus: newStatus,
        ...(success ? { lastPaymentDate: new Date().toISOString() } : {}),
      });
    } else if (checkout.type === "billing" && success) {
      // These trips are already "completed" (prepare-checkout only allows
      // billing checkout for completed trips) — only payment_status changes.
      const batch = db.batch();
      for (const requestId of checkout.requestIds as string[]) {
        batch.update(db.collection("pickupRequests").doc(requestId), {
          payment_status: "paid",
        });
      }
      await batch.commit();
    }

    await checkoutRef.update({
      status: newStatus,
      peachResult,
      finalizedAt: new Date().toISOString(),
    });

    if (success) {
      await sendConfirmationEmail(req.nextUrl.origin, checkout, user.email, peachResult);
    }

    return NextResponse.json(peachResult);
  } catch (error) {
    console.error("Error checking payment status:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
