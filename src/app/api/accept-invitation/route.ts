// app/api/accept-invitation/route.ts
// Joins the signed-in person to the company that invited them. This used to happen in the browser,
// which meant users had to be allowed to write any firmId onto their own profile, and with that
// anyone could make themselves a member of any company (and read its uploaded records). Now the
// firmId only comes from a pending invitation addressed to the caller's verified email.
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuth } from "@/utils/requireAuth";
import { adminAuth, adminDb } from "@/utils/firebaseAdmin";
import { isRateLimited } from "@/utils/rateLimit";
import { checkSeats } from "@/utils/firmSeats";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!user.email || !user.emailVerified) {
    return NextResponse.json({ message: "Please sign in with a verified email address to accept this invitation." }, { status: 403 });
  }
  if (await isRateLimited(adminDb(), `accept_${user.uid}`, 10, 600)) {
    return NextResponse.json({ message: "Too many attempts. Please wait a few minutes and try again." }, { status: 429 });
  }


  let invitationId = "";
  try {
    invitationId = String((await req.json())?.invitationId ?? "");
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }
  if (!invitationId) return NextResponse.json({ message: "invitationId is required" }, { status: 400 });

  try {
    const db = adminDb();
    const invitationRef = db.collection("userInvitations").doc(invitationId);
    const userRef = db.collection("users").doc(user.uid);
    const displayName = (await adminAuth().getUser(user.uid)).displayName ?? null;

    const problem = await db.runTransaction(async (tx) => {
      const [invitation, existing] = await Promise.all([tx.get(invitationRef), tx.get(userRef)]);
      const inv = invitation.data();
      if (!invitation.exists || !inv?.firmId) return { status: 404, message: "Invitation not found" };
      if (inv.status !== "pending") return { status: 409, message: "This invitation has already been used or is no longer valid" };
      if (String(inv.email ?? "").toLowerCase() !== user.email!.toLowerCase()) {
        return { status: 403, message: "This invitation was sent to a different email address." };
      }
      // Joining uses one of the company's seats: check there's one left for this person.
      const noRoom = await checkSeats(db, inv.firmId, { countPendingInvites: false, joining: 1 });
      if (noRoom) return { status: 409, message: `This company can't add anyone right now. ${noRoom}` };

      tx.set(
        userRef,
        {
          email: user.email,
          displayName,
          firmId: inv.firmId,
          role: "user",
          ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
        },
        { merge: true }
      );
      tx.update(invitationRef, { status: "accepted", acceptedAt: FieldValue.serverTimestamp(), acceptedBy: user.uid });
      return null;
    });

    if (problem) return NextResponse.json({ message: problem.message }, { status: problem.status });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error accepting invitation:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
