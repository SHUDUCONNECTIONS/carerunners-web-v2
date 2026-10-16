// app/api/check-payment-status/route.ts
// Called by the payment status pages after the buyer returns from Peach. The
// actual verification and writes live in finalizeCheckout, which the Peach
// webhook (api/peach-webhook) shares so a payment completes even if the buyer
// never comes back. The checkout record saved during prepare-checkout decides
// what is paid for — never client-supplied ids/params.
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/requireAuth";
import { adminDb } from "@/utils/firebaseAdmin";
import { finalizeCheckout } from "@/utils/finalizeCheckout";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ message: "Missing or invalid payment ID" }, { status: 400 });
  }

  try {
    const outcome = await finalizeCheckout(adminDb(), id, {
      origin: process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin,
      onlyForUid: user.uid,
    });
    if (outcome.kind === "missing") return NextResponse.json({ message: "Unknown checkout" }, { status: 404 });
    if (outcome.kind === "forbidden") return NextResponse.json({ message: "Not your checkout" }, { status: 403 });
    return NextResponse.json(outcome.peachResult);
  } catch (error) {
    console.error("Error checking payment status:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
