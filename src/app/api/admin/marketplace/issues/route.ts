// app/api/admin/marketplace/issues/route.ts
// Admin-only: see the reported problems and record the outcome.
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/utils/requireAdmin";
import { adminDb } from "@/utils/firebaseAdmin";
import { toMillis } from "@/lib/marketplace";
import { ISSUES_COLLECTION, MAX_ISSUE_TEXT, type IssueView } from "@/lib/marketplaceIssues";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ message: "Admins only" }, { status: 403 });
  try {
    const snap = await adminDb().collection(ISSUES_COLLECTION).orderBy("createdAt", "desc").limit(100).get();
    const issues: IssueView[] = snap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id, orderId: x.orderId, title: x.title ?? "", reason: x.reason, description: x.description ?? "",
        status: x.status, adminNote: x.adminNote ?? "", buyerEmail: x.buyerEmail ?? "", createdAt: toMillis(x.createdAt),
      };
    });
    return NextResponse.json({ issues });
  } catch (err) {
    console.error("Error loading issues for admin:", err);
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
  const id = typeof body?.issueId === "string" ? body.issueId : "";
  const status = body?.status;
  const note = typeof body?.adminNote === "string" ? body.adminNote.trim().slice(0, MAX_ISSUE_TEXT) : "";
  if (!id || !["open", "resolved", "rejected"].includes(status)) {
    return NextResponse.json({ message: "issueId and a valid status are required" }, { status: 400 });
  }
  try {
    const ref = adminDb().collection(ISSUES_COLLECTION).doc(id);
    if (!(await ref.get()).exists) return NextResponse.json({ message: "Report not found" }, { status: 404 });
    await ref.update({
      status,
      adminNote: note,
      handledBy: admin.email,
      ...(status === "open" ? {} : { resolvedAt: FieldValue.serverTimestamp() }),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error updating issue:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
