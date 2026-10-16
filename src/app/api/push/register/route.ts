// app/api/push/register/route.ts
// Saves (POST) or removes (DELETE) the signed-in person's device token for push alerts. The uid always comes
// from the verified login, never from the request, so nobody can subscribe a device to someone else's alerts.
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuth } from "@/utils/requireAuth";
import { adminDb } from "@/utils/firebaseAdmin";
import { isRateLimited } from "@/utils/rateLimit";
import { PUSH_TOKENS, tokenDocId } from "@/utils/pushServer";

const MAX_TOKENS_PER_USER = 10;

async function readToken(req: NextRequest): Promise<string> {
  try {
    const token = (await req.json())?.token;
    return typeof token === "string" && token.length > 20 && token.length < 4096 ? token : "";
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (await isRateLimited(adminDb(), `pushreg_${user.uid}`, 20, 60)) {
    return NextResponse.json({ message: "Too many requests. Please wait a minute and try again." }, { status: 429 });
  }

  const token = await readToken(req);
  if (!token) return NextResponse.json({ message: "A valid token is required" }, { status: 400 });

  try {
    const db = adminDb();
    const ref = db.collection(PUSH_TOKENS).doc(tokenDocId(token));
    const existing = await ref.get();
    if (!existing.exists) {
      // Keep the newest devices if someone registers a lot of them.
      const mine = await db.collection(PUSH_TOKENS).where("uid", "==", user.uid).get();
      if (mine.size >= MAX_TOKENS_PER_USER) {
        const oldest = mine.docs.sort((a, b) => (a.data().createdAt?.toMillis?.() ?? 0) - (b.data().createdAt?.toMillis?.() ?? 0));
        await Promise.all(oldest.slice(0, mine.size - MAX_TOKENS_PER_USER + 1).map((d) => d.ref.delete()));
      }
    }
    // set() also re-assigns the token if the device was previously used by another account.
    await ref.set({
      uid: user.uid,
      token,
      createdAt: existing.exists ? existing.data()?.createdAt : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("push register failed:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const token = await readToken(req);
  if (!token) return NextResponse.json({ message: "A valid token is required" }, { status: 400 });

  try {
    const ref = adminDb().collection(PUSH_TOKENS).doc(tokenDocId(token));
    const doc = await ref.get();
    if (doc.exists && doc.data()?.uid === user.uid) await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("push unregister failed:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
