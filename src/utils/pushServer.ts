// src/utils/pushServer.ts
// Server-only. Sends a Firebase Cloud Messaging push to every device a person has turned alerts on for.
// Device tokens live in the "pushTokens" collection (doc id = hash of the token), which only the server can touch.
import { createHash } from "crypto";
import { getMessaging } from "firebase-admin/messaging";
import { adminDb } from "@/utils/firebaseAdmin";

export const PUSH_TOKENS = "pushTokens";

export function tokenDocId(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type PushPayload = { title: string; body: string; link: string; tag?: string; urgent?: boolean };

// Errors that mean the device is gone for good (app uninstalled, permission revoked); anything else is transient.
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

export async function sendPushToUser(uid: string, payload: PushPayload): Promise<number> {
  const db = adminDb();
  const snap = await db.collection(PUSH_TOKENS).where("uid", "==", uid).get();
  if (snap.empty) return 0;

  const docs = snap.docs;
  // Data-only: the service worker builds the notification, so it looks the same on every browser.
  const res = await getMessaging().sendEachForMulticast({
    tokens: docs.map((d) => d.data().token as string),
    data: { title: payload.title, body: payload.body, link: payload.link, tag: payload.tag ?? "", urgent: payload.urgent ? "1" : "" },
    webpush: { headers: { Urgency: "high", TTL: "86400" } },
  });

  const dead: string[] = [];
  res.responses.forEach((r, i) => {
    if (!r.success && r.error && DEAD_TOKEN_CODES.has(r.error.code)) dead.push(docs[i].id);
  });
  await Promise.all(dead.map((id) => db.collection(PUSH_TOKENS).doc(id).delete().catch(() => {})));
  return res.successCount;
}
