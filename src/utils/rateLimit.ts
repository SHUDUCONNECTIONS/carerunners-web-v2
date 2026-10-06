// src/utils/rateLimit.ts
// Server-only. A small shared limiter (counts live in Firestore, so it holds across server instances):
// "no more than `limit` requests per `windowSec` seconds for this key". Returns true when over the limit.
import type { Firestore } from "firebase-admin/firestore";

export async function isRateLimited(db: Firestore, key: string, limit: number, windowSec: number): Promise<boolean> {
  const ref = db.collection("rateLimits").doc(key.replace(/[\/\s]/g, "_"));
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const start = snap.data()?.windowStart as number | undefined;
    if (!snap.exists || start === undefined || now - start > windowSec * 1000) {
      tx.set(ref, { windowStart: now, count: 1 });
      return false;
    }
    const count = (snap.data()!.count as number) + 1;
    tx.update(ref, { count });
    return count > limit;
  });
}
