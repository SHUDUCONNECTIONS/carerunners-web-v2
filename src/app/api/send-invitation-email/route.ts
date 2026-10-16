// app/api/send-invitation-email/route.ts
// Emails a team invitation. The caller only says WHICH invitation to send. The recipient, company
// name and link all come from the saved invitation, and the caller must belong to that company, so
// this can't be used to send arbitrary mail or phishing links from our domain.
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/requireAuth";
import { adminDb } from "@/utils/firebaseAdmin";
import { sendInvitation } from "@/utils/email";
import { isRateLimited } from "@/utils/rateLimit";
import { FieldValue } from "firebase-admin/firestore";
import { checkSeats } from "@/utils/firmSeats";

const MAX_SENDS_PER_INVITATION = 3;
const MAX_INVITES_PER_FIRM_PER_DAY = 20;

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  let invitationId = "";
  try {
    invitationId = String((await req.json())?.invitationId ?? "");
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }
  if (!invitationId) return NextResponse.json({ message: "invitationId is required" }, { status: 400 });

  try {
    const db = adminDb();
    if (await isRateLimited(db, `invite_${user.uid}`, 10, 60)) {
      return NextResponse.json({ message: "Too many invitations. Please wait a minute." }, { status: 429 });
    }

    const [invitation, caller] = await Promise.all([
      db.collection("userInvitations").doc(invitationId).get(),
      db.collection("users").doc(user.uid).get(),
    ]);
    const inv = invitation.data();
    if (!invitation.exists || !inv?.email || !inv.firmId) {
      return NextResponse.json({ message: "Invitation not found" }, { status: 404 });
    }
    if (caller.data()?.firmId !== inv.firmId) {
      return NextResponse.json({ message: "That invitation isn't for your company." }, { status: 403 });
    }
    if (inv.status && inv.status !== "pending") {
      return NextResponse.json({ message: "That invitation has already been used." }, { status: 409 });
    }
    // Stops a sign-up being used to mail strangers in bulk: one address can't be emailed over and
    // over, and a company can only invite so many people a day.
    if ((Number(inv.sentCount) || 0) >= MAX_SENDS_PER_INVITATION) {
      return NextResponse.json({ message: "This invitation has already been emailed several times. Ask them to check their spam folder." }, { status: 429 });
    }
    if (await isRateLimited(db, `invite_firm_${inv.firmId}`, MAX_INVITES_PER_FIRM_PER_DAY, 24 * 60 * 60)) {
      return NextResponse.json({ message: "Your company has sent the most invitations allowed for today. Please try again tomorrow." }, { status: 429 });
    }

    // The plan's user limit, checked here because the invitation itself is saved from the browser.
    const noRoom = await checkSeats(db, inv.firmId, { countPendingInvites: true });
    if (noRoom) {
      // An invitation that was never emailed is removed, so it doesn't keep using up a seat.
      if (!inv.sentCount) await invitation.ref.delete().catch(() => {});
      return NextResponse.json({ message: noRoom }, { status: 409 });
    }

    const firm = await db.collection("firms").doc(inv.firmId).get();
    const base = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
    const sent = await sendInvitation({
      email: String(inv.email),
      firmName: firm.data()?.companyName || "your company",
      link: `${base}/auth/accept-invitation?id=${encodeURIComponent(invitationId)}`,
    });
    if (!sent) return NextResponse.json({ message: "Failed to send invitation email" }, { status: 500 });
    await invitation.ref.update({ sentCount: FieldValue.increment(1), lastSentAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error sending invitation email:", err);
    return NextResponse.json({ message: "Failed to process invitation email sending" }, { status: 500 });
  }
}
