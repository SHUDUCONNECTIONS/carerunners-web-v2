// app/api/marketplace/issues/route.ts
// Buyers report a problem with a paid MarketPortal order, and see where their report stands.
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuth } from "@/utils/requireAuth";
import { adminDb } from "@/utils/firebaseAdmin";
import { MARKET_ORDERS, orderLines, orderSummaryText, toMillis } from "@/lib/marketplace";
import { ISSUES_COLLECTION, ISSUE_WINDOW_DAYS, parseIssue, reasonLabel, withinIssueWindow } from "@/lib/marketplaceIssues";
import { isRateLimited } from "@/utils/rateLimit";
import { sendIssueAlert } from "@/utils/email";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const snap = await adminDb().collection(ISSUES_COLLECTION).where("buyerId", "==", user.uid).get();
    return NextResponse.json({
      issues: snap.docs.map((d) => {
        const x = d.data();
        return { id: d.id, orderId: x.orderId, reason: x.reason, status: x.status, adminNote: x.adminNote ?? "", createdAt: toMillis(x.createdAt) };
      }),
    });
  } catch (err) {
    console.error("Error loading issues:", err);
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
  const parsed = parseIssue(body);
  if ("error" in parsed) return NextResponse.json({ message: parsed.error }, { status: 400 });

  try {
    const db = adminDb();
    if (await isRateLimited(db, `issue_${user.uid}`, 5, 600)) {
      return NextResponse.json({ message: "Too many reports. Please wait a few minutes." }, { status: 429 });
    }
    const orderSnap = await db.collection(MARKET_ORDERS).doc(parsed.orderId).get();
    const order = orderSnap.data();
    if (!order || order.buyerId !== user.uid) return NextResponse.json({ message: "Order not found." }, { status: 404 });
    if (order.status !== "paid") return NextResponse.json({ message: "You can report a problem once an order is paid." }, { status: 409 });
    if (!withinIssueWindow(toMillis(order.createdAt))) {
      return NextResponse.json({ message: `Problems must be reported within ${ISSUE_WINDOW_DAYS} days of the order. Please contact us directly.` }, { status: 409 });
    }
    // One open report per order, so the queue stays clear.
    const existing = await db.collection(ISSUES_COLLECTION).where("orderId", "==", parsed.orderId).get();
    if (existing.docs.some((d) => d.data().status === "open")) {
      return NextResponse.json({ message: "You already have an open report for this order. We'll be in touch." }, { status: 409 });
    }

    const lines = orderLines(order as any);
    const title = orderSummaryText(lines, 200);
    await db.collection(ISSUES_COLLECTION).add({
      orderId: parsed.orderId,
      listingIds: lines.map((l) => l.listingId),
      title,
      buyerId: user.uid,
      buyerEmail: user.email ?? "",
      reason: parsed.reason,
      description: parsed.description,
      status: "open",
      adminNote: "",
      createdAt: FieldValue.serverTimestamp(),
    });
    const base = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
    void sendIssueAlert({ title, reason: reasonLabel(parsed.reason), description: parsed.description, buyerEmail: user.email ?? null, link: `${base}/admin/marketplace/issues` });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error saving issue:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
